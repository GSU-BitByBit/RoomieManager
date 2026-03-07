import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GroupMemberStatus, Prisma } from '@prisma/client';

import { FinanceService } from '../../../src/modules/finance/finance.service';

describe('FinanceService', () => {
  const NOW = new Date('2026-03-05T00:00:00.000Z');

  const activeMembership = {
    id: 'gm-1',
    groupId: 'group-1',
    userId: 'user-1',
    role: 'MEMBER',
    status: GroupMemberStatus.ACTIVE,
    joinedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW
  } as const;

  function buildPrismaMock(txMock: any) {
    return {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };
  }

  it('creates a bill, split rows, and ledger entries', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMembership),
        findMany: jest.fn().mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }])
      },
      bill: {
        create: jest.fn().mockResolvedValue({
          id: 'bill-1',
          groupId: 'group-1',
          title: 'Internet bill - March',
          description: null,
          totalAmount: new Prisma.Decimal('76.50'),
          currency: 'USD',
          paidByUserId: 'user-1',
          splitMethod: 'CUSTOM',
          createdBy: 'user-1',
          incurredAt: NOW,
          dueDate: null,
          createdAt: NOW,
          updatedAt: NOW
        })
      },
      billSplit: {
        create: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'split-1',
            billId: 'bill-1',
            groupId: 'group-1',
            userId: 'user-1',
            amount: new Prisma.Decimal('25.50'),
            createdAt: NOW
          })
          .mockResolvedValueOnce({
            id: 'split-2',
            billId: 'bill-1',
            groupId: 'group-1',
            userId: 'user-2',
            amount: new Prisma.Decimal('51.00'),
            createdAt: NOW
          })
      },
      ledgerEntry: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const service = new FinanceService(buildPrismaMock(txMock) as any);

    const result = await service.createBill('user-1', 'group-1', {
      title: 'Internet bill - March',
      totalAmount: 76.5,
      paidByUserId: 'user-1',
      splits: [
        { userId: 'user-1', amount: 25.5 },
        { userId: 'user-2', amount: 51 }
      ]
    } as any);

    expect(result.id).toBe('bill-1');
    expect(result.splits).toHaveLength(2);
    expect(txMock.ledgerEntry.create).toHaveBeenCalledTimes(1);
    expect(txMock.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromUserId: 'user-2',
          toUserId: 'user-1'
        })
      })
    );
  });

  it('rejects bill split totals that do not match totalAmount', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMembership)
      }
    };

    const service = new FinanceService(buildPrismaMock(txMock) as any);

    await expect(
      service.createBill('user-1', 'group-1', {
        title: 'Water bill',
        totalAmount: 60,
        paidByUserId: 'user-1',
        splits: [
          { userId: 'user-1', amount: 30 },
          { userId: 'user-2', amount: 20 }
        ]
      } as any)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns existing payment for repeated idempotency key', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMembership),
        findMany: jest.fn().mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }])
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1',
          groupId: 'group-1',
          billId: null,
          payerUserId: 'user-2',
          payeeUserId: 'user-1',
          amount: new Prisma.Decimal('20.00'),
          currency: 'USD',
          note: null,
          idempotencyKey: 'pay-1',
          paidAt: NOW,
          createdBy: 'user-2',
          createdAt: NOW,
          updatedAt: NOW
        }),
        create: jest.fn()
      },
      ledgerEntry: {
        create: jest.fn()
      }
    };

    const service = new FinanceService(buildPrismaMock(txMock) as any);

    const result = await service.createPayment('user-1', 'group-1', {
      payerUserId: 'user-2',
      payeeUserId: 'user-1',
      amount: 20,
      idempotencyKey: 'pay-1'
    } as any);

    expect(result.id).toBe('payment-1');
    expect(txMock.payment.create).not.toHaveBeenCalled();
    expect(txMock.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it('computes deterministic balances from ledger entries', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMembership),
        findMany: jest.fn().mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }])
      },
      ledgerEntry: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'le-1',
            groupId: 'group-1',
            billId: 'bill-1',
            billSplitId: 'split-1',
            paymentId: null,
            entryType: 'BILL_SPLIT',
            fromUserId: 'user-2',
            toUserId: 'user-1',
            amount: new Prisma.Decimal('51.00'),
            currency: 'USD',
            occurredAt: NOW,
            createdAt: NOW
          },
          {
            id: 'le-2',
            groupId: 'group-1',
            billId: 'bill-1',
            billSplitId: null,
            paymentId: 'payment-1',
            entryType: 'PAYMENT',
            fromUserId: 'user-1',
            toUserId: 'user-2',
            amount: new Prisma.Decimal('20.00'),
            currency: 'USD',
            occurredAt: NOW,
            createdAt: NOW
          }
        ])
      }
    };

    const service = new FinanceService(buildPrismaMock(txMock) as any);
    const result = await service.getBalances('user-1', 'group-1');

    expect(result.balances).toHaveLength(1);
    expect(result.balances[0].settlements).toEqual([
      {
        fromUserId: 'user-2',
        toUserId: 'user-1',
        amount: 31
      }
    ]);
    expect(result.balances[0].memberBalances).toEqual([
      { userId: 'user-1', netAmount: 31 },
      { userId: 'user-2', netAmount: -31 }
    ]);
  });

  it('forbids non-member from reading balances', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    };

    const service = new FinanceService(buildPrismaMock(txMock) as any);

    await expect(service.getBalances('user-9', 'group-1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
