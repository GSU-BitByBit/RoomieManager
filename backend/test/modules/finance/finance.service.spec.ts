import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { GroupMemberRole, GroupMemberStatus, Prisma } from '@prisma/client';

import { FinanceService } from '../../../src/modules/finance/finance.service';

describe('FinanceService', () => {
  const NOW = new Date('2026-03-05T00:00:00.000Z');

  const activeMembership = {
    id: 'gm-1',
    groupId: 'group-1',
    userId: 'user-1',
    role: GroupMemberRole.MEMBER,
    status: GroupMemberStatus.ACTIVE,
    joinedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW
  } as const;

  const adminMembership = {
    id: 'gm-admin',
    groupId: 'group-1',
    userId: 'admin-1',
    role: GroupMemberRole.ADMIN,
    status: GroupMemberStatus.ACTIVE,
    joinedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW
  } as const;

  const payerMembership = {
    id: 'gm-payer',
    groupId: 'group-1',
    userId: 'user-2',
    role: GroupMemberRole.MEMBER,
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
    expect(result.splitMethod).toBe('CUSTOM');
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

  it('forbids non-admin third parties from recording payments between other members', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMembership)
      }
    };

    const service = new FinanceService(buildPrismaMock(txMock) as any);

    await expect(
      service.createPayment('user-1', 'group-1', {
        payerUserId: 'user-2',
        payeeUserId: 'user-3',
        amount: 20
      } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a group admin to record a payment between other members', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(adminMembership),
        findMany: jest.fn().mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }])
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'payment-1',
          groupId: 'group-1',
          billId: null,
          payerUserId: 'user-2',
          payeeUserId: 'user-1',
          amount: new Prisma.Decimal('20.00'),
          currency: 'USD',
          note: null,
          idempotencyKey: null,
          paidAt: NOW,
          createdBy: 'admin-1',
          createdAt: NOW,
          updatedAt: NOW
        })
      },
      ledgerEntry: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const service = new FinanceService(buildPrismaMock(txMock) as any);

    const result = await service.createPayment('admin-1', 'group-1', {
      payerUserId: 'user-2',
      payeeUserId: 'user-1',
      amount: 20,
      paidAt: NOW
    } as any);

    expect(result.id).toBe('payment-1');
    expect(txMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdBy: 'admin-1',
          payerUserId: 'user-2',
          payeeUserId: 'user-1'
        })
      })
    );
  });

  it('returns existing payment for repeated idempotency key with the same canonical payload', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(payerMembership),
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

    const result = await service.createPayment('user-2', 'group-1', {
      payerUserId: 'user-2',
      payeeUserId: 'user-1',
      amount: 20,
      idempotencyKey: 'pay-1'
    } as any);

    expect(result.id).toBe('payment-1');
    expect(txMock.payment.create).not.toHaveBeenCalled();
    expect(txMock.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects reusing an idempotency key with a different canonical payload', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(payerMembership),
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

    await expect(
      service.createPayment('user-2', 'group-1', {
        payerUserId: 'user-2',
        payeeUserId: 'user-1',
        amount: 21,
        idempotencyKey: 'pay-1'
      } as any)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns the existing payment after a duplicate-key race when the canonical payload matches', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(payerMembership),
        findMany: jest.fn().mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }])
      },
      payment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'payment-1',
            groupId: 'group-1',
            billId: null,
            payerUserId: 'user-2',
            payeeUserId: 'user-1',
            amount: new Prisma.Decimal('20.00'),
            currency: 'USD',
            note: 'Paid via Zelle',
            idempotencyKey: 'pay-1',
            paidAt: NOW,
            createdBy: 'user-2',
            createdAt: NOW,
            updatedAt: NOW
          }),
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('duplicate payment key', {
            code: 'P2002',
            clientVersion: '5.22.0'
          })
        )
      },
      ledgerEntry: {
        create: jest.fn()
      }
    };

    const service = new FinanceService(buildPrismaMock(txMock) as any);

    const result = await service.createPayment('user-2', 'group-1', {
      payerUserId: 'user-2',
      payeeUserId: 'user-1',
      amount: 20,
      note: 'Paid via Zelle',
      paidAt: NOW,
      idempotencyKey: 'pay-1'
    } as any);

    expect(result.id).toBe('payment-1');
    expect(txMock.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate-key race when the existing payment payload differs', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(payerMembership),
        findMany: jest.fn().mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }])
      },
      payment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
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
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('duplicate payment key', {
            code: 'P2002',
            clientVersion: '5.22.0'
          })
        )
      },
      ledgerEntry: {
        create: jest.fn()
      }
    };

    const service = new FinanceService(buildPrismaMock(txMock) as any);

    await expect(
      service.createPayment('user-2', 'group-1', {
        payerUserId: 'user-2',
        payeeUserId: 'user-1',
        amount: 20,
        note: 'Different note',
        paidAt: NOW,
        idempotencyKey: 'pay-1'
      } as any)
    ).rejects.toBeInstanceOf(ConflictException);
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

  it('omits inactive zero-net members from actionable balances and settlements', async () => {
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
            fromUserId: 'user-1',
            toUserId: 'user-3',
            amount: new Prisma.Decimal('10.00'),
            currency: 'USD',
            occurredAt: NOW,
            createdAt: NOW
          },
          {
            id: 'le-2',
            groupId: 'group-1',
            billId: null,
            billSplitId: null,
            paymentId: 'payment-1',
            entryType: 'PAYMENT',
            fromUserId: 'user-3',
            toUserId: 'user-2',
            amount: new Prisma.Decimal('10.00'),
            currency: 'USD',
            occurredAt: NOW,
            createdAt: NOW
          }
        ])
      }
    };

    const service = new FinanceService(buildPrismaMock(txMock) as any);
    const result = await service.getBalances('user-1', 'group-1');

    expect(result.balances[0].memberBalances).toEqual([
      { userId: 'user-1', netAmount: -10 },
      { userId: 'user-2', netAmount: 10 }
    ]);
    expect(result.balances[0].settlements).toEqual([
      {
        fromUserId: 'user-1',
        toUserId: 'user-2',
        amount: 10
      }
    ]);
  });

  it('rejects balances when an inactive member still has a non-zero net amount', async () => {
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
            fromUserId: 'user-3',
            toUserId: 'user-1',
            amount: new Prisma.Decimal('12.50'),
            currency: 'USD',
            occurredAt: NOW,
            createdAt: NOW
          }
        ])
      }
    };

    const service = new FinanceService(buildPrismaMock(txMock) as any);

    await expect(service.getBalances('user-1', 'group-1')).rejects.toBeInstanceOf(
      ConflictException
    );
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
