import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GroupMemberRole, GroupMemberStatus } from '@prisma/client';

import { ContractsService } from '../../../src/modules/contracts/contracts.service';

describe('ContractsService', () => {
  const NOW = new Date('2026-03-05T00:00:00.000Z');

  const activeMember = (role: GroupMemberRole = GroupMemberRole.MEMBER) => ({
    id: 'gm-1',
    groupId: 'group-1',
    userId: 'user-1',
    role,
    status: GroupMemberStatus.ACTIVE
  });

  const baseContract = {
    id: 'contract-1',
    groupId: 'group-1',
    draftContent: 'Draft rules here.',
    publishedVersion: null as number | null,
    updatedBy: 'user-1',
    createdAt: NOW,
    updatedAt: NOW
  };

  function buildPrismaMock(txMock: any) {
    return {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(txMock))
    };
  }

  it('returns empty contract when none exists yet', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMember())
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    };

    const service = new ContractsService(buildPrismaMock(txMock) as any);
    const result = await service.getContract('user-1', 'group-1');

    expect(result.contract.draftContent).toBe('');
    expect(result.latestPublishedContent).toBeNull();
  });

  it('returns contract with latest published content', async () => {
    const contract = { ...baseContract, publishedVersion: 2 };

    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMember())
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue(contract)
      },
      contractVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cv-2',
          version: 2,
          content: 'Published rules v2.',
          publishedBy: 'user-1',
          createdAt: NOW
        })
      }
    };

    const service = new ContractsService(buildPrismaMock(txMock) as any);
    const result = await service.getContract('user-1', 'group-1');

    expect(result.contract.publishedVersion).toBe(2);
    expect(result.latestPublishedContent).toBe('Published rules v2.');
  });

  it('forbids non-member from viewing contract', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    };

    const service = new ContractsService(buildPrismaMock(txMock) as any);

    await expect(service.getContract('user-1', 'group-1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('allows admin to update draft via upsert', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMember(GroupMemberRole.ADMIN))
      },
      contract: {
        upsert: jest.fn().mockResolvedValue({
          ...baseContract,
          draftContent: 'Updated draft.'
        })
      }
    };

    const service = new ContractsService(buildPrismaMock(txMock) as any);
    const result = await service.updateDraft('user-1', 'group-1', { content: 'Updated draft.' });

    expect(result.draftContent).toBe('Updated draft.');
    expect(txMock.contract.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { groupId: 'group-1' },
        update: expect.objectContaining({ draftContent: 'Updated draft.' })
      })
    );
  });

  it('forbids non-admin from updating draft', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMember(GroupMemberRole.MEMBER))
      }
    };

    const service = new ContractsService(buildPrismaMock(txMock) as any);

    await expect(
      service.updateDraft('user-1', 'group-1', { content: 'Hack attempt.' })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('publishes draft as new version and increments version counter', async () => {
    const contract = { ...baseContract, publishedVersion: 1 };
    const newVersion = {
      id: 'cv-2',
      groupId: 'group-1',
      contractId: 'contract-1',
      version: 2,
      content: 'Draft rules here.',
      publishedBy: 'user-1',
      createdAt: NOW
    };

    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMember(GroupMemberRole.ADMIN))
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue(contract),
        update: jest.fn().mockResolvedValue({ ...contract, publishedVersion: 2 })
      },
      contractVersion: {
        create: jest.fn().mockResolvedValue(newVersion)
      }
    };

    const service = new ContractsService(buildPrismaMock(txMock) as any);
    const result = await service.publishVersion('user-1', 'group-1');

    expect(result.version).toBe(2);
    expect(result.content).toBe('Draft rules here.');
    expect(txMock.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { publishedVersion: 2 } })
    );
  });

  it('rejects publish when draft is empty', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMember(GroupMemberRole.ADMIN))
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue({ ...baseContract, draftContent: '  ' })
      }
    };

    const service = new ContractsService(buildPrismaMock(txMock) as any);

    await expect(service.publishVersion('user-1', 'group-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('rejects publish when no contract exists', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMember(GroupMemberRole.ADMIN))
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    };

    const service = new ContractsService(buildPrismaMock(txMock) as any);

    await expect(service.publishVersion('user-1', 'group-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('forbids non-admin from publishing', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMember(GroupMemberRole.MEMBER))
      }
    };

    const service = new ContractsService(buildPrismaMock(txMock) as any);

    await expect(service.publishVersion('user-1', 'group-1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('lists versions in descending order', async () => {
    const versions = [
      { id: 'cv-2', version: 2, content: 'v2', publishedBy: 'user-1', createdAt: NOW },
      { id: 'cv-1', version: 1, content: 'v1', publishedBy: 'user-1', createdAt: NOW }
    ];

    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMember())
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue(baseContract)
      },
      contractVersion: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue(versions)
      }
    };

    const service = new ContractsService(buildPrismaMock(txMock) as any);
    const result = await service.listVersions('user-1', 'group-1');

    expect(result.versions).toHaveLength(2);
    expect(result.versions[0].version).toBe(2);
    expect(result.versions[1].version).toBe(1);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });
    expect(txMock.contractVersion.count).toHaveBeenCalledWith({
      where: { contractId: 'contract-1' }
    });
    expect(txMock.contractVersion.findMany).toHaveBeenCalledWith({
      where: { contractId: 'contract-1' },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      skip: 0,
      take: 20
    });
  });

  it('returns empty versions when no contract exists', async () => {
    const txMock = {
      groupMember: {
        findUnique: jest.fn().mockResolvedValue(activeMember())
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    };

    const service = new ContractsService(buildPrismaMock(txMock) as any);
    const result = await service.listVersions('user-1', 'group-1');

    expect(result.versions).toHaveLength(0);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    });
  });
});
