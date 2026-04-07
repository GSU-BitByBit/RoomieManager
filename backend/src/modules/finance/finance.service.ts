import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  GroupMemberRole,
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

interface CanonicalPaymentPayload {
  actorUserId: string;
  payerUserId: string;
  payeeUserId: string;
  amountCents: number;
  currency: string;
  billId: string | null;
  note: string | null;
  paidAtIso: string | null;
}

interface MemberNetBalanceCents {
  userId: string;
  netAmountCents: number;
}

interface CurrencyBalanceSnapshot {
  currency: string;
  memberNetByUserId: Map<string, number>;
  activeMemberBalances: MemberNetBalanceCents[];
  inactiveNonZeroBalances: MemberNetBalanceCents[];
}

export interface MemberNetBalanceSummary {
  currency: string;
  netAmount: number;
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
      const membership = await this.assertActiveMembership(tx, actorUserId, groupId);

      const payerUserId = payload.payerUserId.trim();
      const payeeUserId = payload.payeeUserId.trim();

      if (payerUserId === payeeUserId) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'Payer and payee must be different users.'
        });
      }

      if (actorUserId !== payerUserId && membership.role !== GroupMemberRole.ADMIN) {
        throw new ForbiddenException({
          code: ErrorCode.Forbidden,
          message: 'Only the payer or a group admin can record this payment.'
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

      const note = payload.note?.trim() || null;
      const requestedPaidAt = payload.paidAt ?? null;
      const canonicalPayload = this.buildCanonicalPaymentPayload({
        actorUserId,
        payerUserId,
        payeeUserId,
        amountCents,
        currency,
        billId,
        note,
        paidAt: requestedPaidAt
      });
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
          return this.resolveIdempotentPayment(existing, canonicalPayload, idempotencyKey);
        }
      }

      const paidAt = requestedPaidAt ?? new Date();

      let payment: Payment;
      try {
        payment = await tx.payment.create({
          data: {
            groupId,
            billId,
            payerUserId,
            payeeUserId,
            amount: this.toDecimal(amountCents),
            currency,
            note,
            idempotencyKey,
            paidAt,
            createdBy: actorUserId
          }
        });
      } catch (error) {
        if (!idempotencyKey || !this.isUniqueConstraintError(error)) {
          throw error;
        }

        const existing = await tx.payment.findUnique({
          where: {
            groupId_idempotencyKey: {
              groupId,
              idempotencyKey
            }
          }
        });

        if (!existing) {
          throw error;
        }

        return this.resolveIdempotentPayment(existing, canonicalPayload, idempotencyKey);
      }

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

      const snapshots = await this.buildCurrencyBalanceSnapshots(tx, groupId);
      const inactiveMemberBalances = snapshots.flatMap((snapshot) =>
        snapshot.inactiveNonZeroBalances.map((balance) => ({
          userId: balance.userId,
          currency: snapshot.currency,
          netAmount: this.fromCentsToNumber(balance.netAmountCents)
        }))
      );

      if (inactiveMemberBalances.length > 0) {
        throw new ConflictException({
          code: ErrorCode.Conflict,
          message:
            'Current balances cannot be shown because one or more inactive members still have non-zero balances. Reactivate them or settle those balances first.',
          details: {
            inactiveMemberBalances
          }
        });
      }

      const balances: CurrencyBalanceSummary[] = snapshots.map((snapshot) => ({
        currency: snapshot.currency,
        settlements: this.computeSettlements(snapshot.activeMemberBalances),
        memberBalances: snapshot.activeMemberBalances.map((balance) => ({
          userId: balance.userId,
          netAmount: this.fromCentsToNumber(balance.netAmountCents)
        }))
      }));

      return {
        groupId,
        balances
      };
    });
  }

  private buildCanonicalPaymentPayload(input: {
    actorUserId: string;
    payerUserId: string;
    payeeUserId: string;
    amountCents: number;
    currency: string;
    billId: string | null;
    note: string | null;
    paidAt: Date | null;
  }): CanonicalPaymentPayload {
    return {
      actorUserId: input.actorUserId,
      payerUserId: input.payerUserId,
      payeeUserId: input.payeeUserId,
      amountCents: input.amountCents,
      currency: input.currency,
      billId: input.billId,
      note: input.note,
      paidAtIso: input.paidAt?.toISOString() ?? null
    };
  }

  private resolveIdempotentPayment(
    existing: Payment,
    canonicalPayload: CanonicalPaymentPayload,
    idempotencyKey: string
  ): PaymentSummary {
    if (this.paymentMatchesCanonicalPayload(existing, canonicalPayload)) {
      return this.mapPaymentSummary(existing);
    }

    throw new ConflictException({
      code: ErrorCode.Conflict,
      message: 'This idempotency key has already been used for a different payment payload.',
      details: {
        idempotencyKey,
        existingPaymentId: existing.id
      }
    });
  }

  private paymentMatchesCanonicalPayload(
    existing: Payment,
    canonicalPayload: CanonicalPaymentPayload
  ): boolean {
    const samePaidAt =
      canonicalPayload.paidAtIso === null ||
      existing.paidAt.toISOString() === canonicalPayload.paidAtIso;

    return (
      existing.createdBy === canonicalPayload.actorUserId &&
      existing.payerUserId === canonicalPayload.payerUserId &&
      existing.payeeUserId === canonicalPayload.payeeUserId &&
      this.fromDecimalToCents(existing.amount) === canonicalPayload.amountCents &&
      existing.currency === canonicalPayload.currency &&
      existing.billId === canonicalPayload.billId &&
      (existing.note ?? null) === canonicalPayload.note &&
      samePaidAt
    );
  }

  private isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  async getMemberNetBalancesByCurrency(
    tx: Prisma.TransactionClient,
    groupId: string,
    memberUserId: string
  ): Promise<MemberNetBalanceSummary[]> {
    const snapshots = await this.buildCurrencyBalanceSnapshots(tx, groupId);

    return snapshots
      .map((snapshot) => ({
        currency: snapshot.currency,
        netAmount: this.fromCentsToNumber(snapshot.memberNetByUserId.get(memberUserId) ?? 0)
      }))
      .filter((balance) => balance.netAmount !== 0);
  }

  private async buildCurrencyBalanceSnapshots(
    tx: Prisma.TransactionClient,
    groupId: string
  ): Promise<CurrencyBalanceSnapshot[]> {
    const activeMembers = await tx.groupMember.findMany({
      where: {
        groupId,
        status: GroupMemberStatus.ACTIVE
      },
      select: { userId: true },
      orderBy: { joinedAt: 'asc' }
    });
    const activeUserIds = activeMembers.map((member) => member.userId);
    const activeUserIdSet = new Set(activeUserIds);

    const entries = await tx.ledgerEntry.findMany({
      where: { groupId },
      orderBy: [{ currency: 'asc' }, { occurredAt: 'asc' }, { createdAt: 'asc' }]
    });

    const currencyMaps = new Map<string, Map<string, number>>();

    for (const entry of entries) {
      const currency = entry.currency;
      let memberNetByUserId = currencyMaps.get(currency);

      if (!memberNetByUserId) {
        memberNetByUserId = new Map<string, number>();
        for (const activeUserId of activeUserIds) {
          memberNetByUserId.set(activeUserId, 0);
        }

        currencyMaps.set(currency, memberNetByUserId);
      }

      const amountCents = this.fromDecimalToCents(entry.amount);
      if (amountCents === 0) {
        continue;
      }

      memberNetByUserId.set(
        entry.fromUserId,
        (memberNetByUserId.get(entry.fromUserId) ?? 0) - amountCents
      );
      memberNetByUserId.set(
        entry.toUserId,
        (memberNetByUserId.get(entry.toUserId) ?? 0) + amountCents
      );
    }

    return Array.from(currencyMaps.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, memberNetByUserId]) => ({
        currency,
        memberNetByUserId,
        activeMemberBalances: activeUserIds.map((activeUserId) => ({
          userId: activeUserId,
          netAmountCents: memberNetByUserId.get(activeUserId) ?? 0
        })),
        inactiveNonZeroBalances: Array.from(memberNetByUserId.entries())
          .filter(
            ([memberUserId, amountCents]) => !activeUserIdSet.has(memberUserId) && amountCents !== 0
          )
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([memberUserId, amountCents]) => ({
            userId: memberUserId,
            netAmountCents: amountCents
          }))
      }));
  }

  private computeSettlements(memberBalances: MemberNetBalanceCents[]): SettlementSummary[] {
    const creditors = memberBalances
      .filter((balance) => balance.netAmountCents > 0)
      .map((balance) => ({
        userId: balance.userId,
        amountCents: balance.netAmountCents
      }))
      .sort((left, right) => left.userId.localeCompare(right.userId));
    const debtors = memberBalances
      .filter((balance) => balance.netAmountCents < 0)
      .map((balance) => ({
        userId: balance.userId,
        amountCents: Math.abs(balance.netAmountCents)
      }))
      .sort((left, right) => left.userId.localeCompare(right.userId));
    const settlements: SettlementSummary[] = [];

    let creditorIndex = 0;
    let debtorIndex = 0;

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];
      const settledAmountCents = Math.min(creditor.amountCents, debtor.amountCents);

      if (settledAmountCents > 0) {
        settlements.push({
          fromUserId: debtor.userId,
          toUserId: creditor.userId,
          amount: this.fromCentsToNumber(settledAmountCents)
        });
      }

      creditor.amountCents -= settledAmountCents;
      debtor.amountCents -= settledAmountCents;

      if (creditor.amountCents === 0) {
        creditorIndex += 1;
      }

      if (debtor.amountCents === 0) {
        debtorIndex += 1;
      }
    }

    return settlements;
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
      splitMethod: 'CUSTOM',
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
