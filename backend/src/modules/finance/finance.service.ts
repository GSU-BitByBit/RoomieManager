import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  GroupMemberStatus,
  LedgerEntryType,
  Prisma,
  type Bill,
  type BillSplit,
  type GroupMember,
  type Payment
} from '@prisma/client';

import { ErrorCode } from '../../common/http/http-error-code';
import { buildPaginationMeta, resolvePagination } from '../../common/http/pagination';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateBillDto, CreateBillSplitDto } from './dto/create-bill.dto';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import { ListBillsQueryDto } from './dto/list-bills.query';
import type {
  BillSplitSummary,
  BillSummary,
  CurrencyBalanceSummary,
  GroupBalancesResponse,
  GroupBillsResponse,
  PaymentSummary,
  SettlementSummary
} from './interfaces/finance-response.interface';

const DEFAULT_CURRENCY = 'USD';

interface NormalizedSplit {
  userId: string;
  amountCents: number;
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createBill(
    actorUserId: string,
    groupId: string,
    payload: CreateBillDto
  ): Promise<BillSummary> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertActiveMembership(tx, actorUserId, groupId);

      const currency = this.normalizeCurrency(payload.currency);
      const totalAmountCents = this.toCents(payload.totalAmount, 'totalAmount');
      const splits = this.normalizeSplits(payload.splits, totalAmountCents);

      const usersToValidate = [payload.paidByUserId.trim(), ...splits.map((split) => split.userId)];
      await this.assertUsersAreActiveMembers(tx, groupId, usersToValidate);

      const bill = await tx.bill.create({
        data: {
          groupId,
          title: payload.title.trim(),
          description: payload.description?.trim() || null,
          totalAmount: this.toDecimal(totalAmountCents),
          currency,
          paidByUserId: payload.paidByUserId.trim(),
          splitMethod: 'CUSTOM',
          createdBy: actorUserId,
          incurredAt: payload.incurredAt ?? new Date(),
          dueDate: payload.dueDate ?? null
        }
      });

      const createdSplits: BillSplit[] = [];

      for (const split of splits) {
        const splitRow = await tx.billSplit.create({
          data: {
            billId: bill.id,
            groupId,
            userId: split.userId,
            amount: this.toDecimal(split.amountCents)
          }
        });

        createdSplits.push(splitRow);

        if (split.userId !== bill.paidByUserId && split.amountCents > 0) {
          await tx.ledgerEntry.create({
            data: {
              groupId,
              billId: bill.id,
              billSplitId: splitRow.id,
              entryType: LedgerEntryType.BILL_SPLIT,
              fromUserId: split.userId,
              toUserId: bill.paidByUserId,
              amount: this.toDecimal(split.amountCents),
              currency,
              occurredAt: bill.incurredAt
            }
          });
        }
      }

      return this.mapBillSummary(bill, createdSplits);
    });
  }

  async listBills(
    userId: string,
    groupId: string,
    query: ListBillsQueryDto = new ListBillsQueryDto()
  ): Promise<GroupBillsResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertActiveMembership(tx, userId, groupId);
      const pagination = resolvePagination(query);

      const totalBills = await tx.bill.count({
        where: { groupId }
      });

      const bills = await tx.bill.findMany({
        where: { groupId },
        include: {
          splits: {
            orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }]
          }
        },
        orderBy: this.buildBillOrderBy(query),
        skip: pagination.skip,
        take: pagination.take
      });

      return {
        groupId,
        bills: bills.map((bill) => this.mapBillSummary(bill, bill.splits)),
        pagination: buildPaginationMeta(pagination.page, pagination.pageSize, totalBills)
      };
    });
  }

  async createPayment(
    actorUserId: string,
    groupId: string,
    payload: CreatePaymentDto
  ): Promise<PaymentSummary> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertActiveMembership(tx, actorUserId, groupId);

      const payerUserId = payload.payerUserId.trim();
      const payeeUserId = payload.payeeUserId.trim();

      if (payerUserId === payeeUserId) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'Payer and payee must be different users.'
        });
      }

      const amountCents = this.toCents(payload.amount, 'amount');
      const currency = this.normalizeCurrency(payload.currency);

      await this.assertUsersAreActiveMembers(tx, groupId, [payerUserId, payeeUserId]);

      let billId: string | null = null;
      if (payload.billId) {
        const bill = await tx.bill.findFirst({
          where: {
            id: payload.billId.trim(),
            groupId
          }
        });

        if (!bill) {
          throw new NotFoundException({
            code: ErrorCode.NotFound,
            message: 'Bill not found in this group.'
          });
        }

        if (bill.currency !== currency) {
          throw new BadRequestException({
            code: ErrorCode.BadRequest,
            message: 'Payment currency must match bill currency.'
          });
        }

        billId = bill.id;
      }

      const idempotencyKey = payload.idempotencyKey?.trim() || null;
      if (idempotencyKey) {
        const existing = await tx.payment.findUnique({
          where: {
            groupId_idempotencyKey: {
              groupId,
              idempotencyKey
            }
          }
        });

        if (existing) {
          return this.mapPaymentSummary(existing);
        }
      }

      const paidAt = payload.paidAt ?? new Date();

      const payment = await tx.payment.create({
        data: {
          groupId,
          billId,
          payerUserId,
          payeeUserId,
          amount: this.toDecimal(amountCents),
          currency,
          note: payload.note?.trim() || null,
          idempotencyKey,
          paidAt,
          createdBy: actorUserId
        }
      });

      await tx.ledgerEntry.create({
        data: {
          groupId,
          billId,
          paymentId: payment.id,
          entryType: LedgerEntryType.PAYMENT,
          fromUserId: payeeUserId,
          toUserId: payerUserId,
          amount: this.toDecimal(amountCents),
          currency,
          occurredAt: payment.paidAt
        }
      });

      return this.mapPaymentSummary(payment);
    });
  }

  async getBalances(userId: string, groupId: string): Promise<GroupBalancesResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertActiveMembership(tx, userId, groupId);

      const activeMembers = await tx.groupMember.findMany({
        where: {
          groupId,
          status: GroupMemberStatus.ACTIVE
        },
        select: { userId: true },
        orderBy: { joinedAt: 'asc' }
      });

      const activeUserIds = activeMembers.map((member) => member.userId);

      const entries = await tx.ledgerEntry.findMany({
        where: { groupId },
        orderBy: [{ currency: 'asc' }, { occurredAt: 'asc' }, { createdAt: 'asc' }]
      });

      const currencyMaps = new Map<
        string,
        {
          directed: Map<string, number>;
          memberNet: Map<string, number>;
        }
      >();

      for (const entry of entries) {
        const currency = entry.currency;
        let state = currencyMaps.get(currency);

        if (!state) {
          const memberNet = new Map<string, number>();
          for (const userIdItem of activeUserIds) {
            memberNet.set(userIdItem, 0);
          }

          state = {
            directed: new Map<string, number>(),
            memberNet
          };

          currencyMaps.set(currency, state);
        }

        const amountCents = this.fromDecimalToCents(entry.amount);
        if (amountCents === 0) {
          continue;
        }

        const forwardKey = this.pairKey(entry.fromUserId, entry.toUserId);
        state.directed.set(forwardKey, (state.directed.get(forwardKey) ?? 0) + amountCents);

        state.memberNet.set(
          entry.fromUserId,
          (state.memberNet.get(entry.fromUserId) ?? 0) - amountCents
        );
        state.memberNet.set(
          entry.toUserId,
          (state.memberNet.get(entry.toUserId) ?? 0) + amountCents
        );
      }

      const balances: CurrencyBalanceSummary[] = Array.from(currencyMaps.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([currency, state]) => {
          const settlements = this.computeSettlements(state.directed);
          const memberBalances = Array.from(state.memberNet.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([memberUserId, amountCents]) => ({
              userId: memberUserId,
              netAmount: this.fromCentsToNumber(amountCents)
            }));

          return {
            currency,
            settlements,
            memberBalances
          };
        });

      return {
        groupId,
        balances
      };
    });
  }

  private computeSettlements(directed: Map<string, number>): SettlementSummary[] {
    const visited = new Set<string>();
    const settlements: SettlementSummary[] = [];

    for (const [key, amount] of directed.entries()) {
      if (visited.has(key) || amount <= 0) {
        continue;
      }

      const [fromUserId, toUserId] = this.fromPairKey(key);
      const reverseKey = this.pairKey(toUserId, fromUserId);
      const reverseAmount = directed.get(reverseKey) ?? 0;
      const net = amount - reverseAmount;

      if (net > 0) {
        settlements.push({
          fromUserId,
          toUserId,
          amount: this.fromCentsToNumber(net)
        });
      } else if (net < 0) {
        settlements.push({
          fromUserId: toUserId,
          toUserId: fromUserId,
          amount: this.fromCentsToNumber(Math.abs(net))
        });
      }

      visited.add(key);
      visited.add(reverseKey);
    }

    return settlements.sort((left, right) => {
      if (left.fromUserId === right.fromUserId) {
        return left.toUserId.localeCompare(right.toUserId);
      }
      return left.fromUserId.localeCompare(right.fromUserId);
    });
  }

  private normalizeSplits(
    splits: CreateBillSplitDto[],
    totalAmountCents: number
  ): NormalizedSplit[] {
    const normalized: NormalizedSplit[] = [];
    const seenUserIds = new Set<string>();

    let splitTotalCents = 0;

    for (const split of splits) {
      const userId = split.userId.trim();

      if (userId.length === 0) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'Each split row must include a userId.'
        });
      }

      if (seenUserIds.has(userId)) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'Each user can appear only once in bill splits.'
        });
      }

      seenUserIds.add(userId);

      const amountCents = this.toCents(split.amount, 'splits.amount');
      if (amountCents <= 0) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'Split amounts must be greater than zero.'
        });
      }

      splitTotalCents += amountCents;
      normalized.push({ userId, amountCents });
    }

    if (splitTotalCents !== totalAmountCents) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: 'Split amounts must sum exactly to totalAmount.'
      });
    }

    return normalized;
  }

  private async assertActiveMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    groupId: string
  ): Promise<GroupMember> {
    const membership = await tx.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      }
    });

    if (!membership || membership.status !== GroupMemberStatus.ACTIVE) {
      throw new ForbiddenException({
        code: ErrorCode.Forbidden,
        message: 'You do not have access to this group.'
      });
    }

    return membership;
  }

  private async assertUsersAreActiveMembers(
    tx: Prisma.TransactionClient,
    groupId: string,
    userIds: string[]
  ): Promise<void> {
    const normalizedUserIds = Array.from(new Set(userIds.map((userId) => userId.trim())));

    const members = await tx.groupMember.findMany({
      where: {
        groupId,
        status: GroupMemberStatus.ACTIVE,
        userId: {
          in: normalizedUserIds
        }
      },
      select: {
        userId: true
      }
    });

    if (members.length !== normalizedUserIds.length) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: 'All referenced users must be active members of this group.'
      });
    }
  }

  private normalizeCurrency(input?: string): string {
    const normalized = (input ?? DEFAULT_CURRENCY).trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(normalized)) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: 'Currency must be a 3-letter ISO code.'
      });
    }

    return normalized;
  }

  private toCents(value: number, fieldName: string): number {
    if (!Number.isFinite(value)) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: `${fieldName} must be a valid number.`
      });
    }

    const scaled = value * 100;
    const rounded = Math.round(scaled);

    if (Math.abs(scaled - rounded) > 0.000001) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: `${fieldName} supports at most 2 decimal places.`
      });
    }

    if (rounded <= 0) {
      throw new BadRequestException({
        code: ErrorCode.BadRequest,
        message: `${fieldName} must be greater than zero.`
      });
    }

    return rounded;
  }

  private toDecimal(cents: number): Prisma.Decimal {
    return new Prisma.Decimal(cents).div(100);
  }

  private fromDecimalToCents(value: Prisma.Decimal): number {
    const numericValue = Number(value.toString());
    return Math.round(numericValue * 100);
  }

  private fromCentsToNumber(cents: number): number {
    return Number((cents / 100).toFixed(2));
  }

  private mapBillSummary(bill: Bill, splits: BillSplit[]): BillSummary {
    return {
      id: bill.id,
      groupId: bill.groupId,
      title: bill.title,
      description: bill.description,
      totalAmount: Number(bill.totalAmount.toString()),
      currency: bill.currency,
      paidByUserId: bill.paidByUserId,
      splitMethod: bill.splitMethod,
      createdBy: bill.createdBy,
      incurredAt: bill.incurredAt.toISOString(),
      dueDate: bill.dueDate?.toISOString() ?? null,
      createdAt: bill.createdAt.toISOString(),
      updatedAt: bill.updatedAt.toISOString(),
      splits: splits.map((split) => this.mapBillSplitSummary(split))
    };
  }

  private mapBillSplitSummary(split: BillSplit): BillSplitSummary {
    return {
      id: split.id,
      userId: split.userId,
      amount: Number(split.amount.toString()),
      createdAt: split.createdAt.toISOString()
    };
  }

  private mapPaymentSummary(payment: Payment): PaymentSummary {
    return {
      id: payment.id,
      groupId: payment.groupId,
      billId: payment.billId,
      payerUserId: payment.payerUserId,
      payeeUserId: payment.payeeUserId,
      amount: Number(payment.amount.toString()),
      currency: payment.currency,
      note: payment.note,
      idempotencyKey: payment.idempotencyKey,
      paidAt: payment.paidAt.toISOString(),
      createdBy: payment.createdBy,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString()
    };
  }

  private pairKey(fromUserId: string, toUserId: string): string {
    return `${fromUserId}|${toUserId}`;
  }

  private fromPairKey(key: string): [string, string] {
    const [fromUserId, toUserId] = key.split('|');
    return [fromUserId, toUserId];
  }

  private buildBillOrderBy(query: ListBillsQueryDto): Prisma.BillOrderByWithRelationInput[] {
    switch (query.sortBy) {
      case 'createdAt':
        return [{ createdAt: query.sortOrder }, { incurredAt: query.sortOrder }];
      case 'totalAmount':
        return [{ totalAmount: query.sortOrder }, { createdAt: 'desc' }];
      case 'incurredAt':
      default:
        return [{ incurredAt: query.sortOrder }, { createdAt: query.sortOrder }];
    }
  }
}
