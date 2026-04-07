import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  ChoreStatus,
  ChoreTemplateStatus,
  GroupMemberRole,
  GroupMemberStatus,
  Prisma,
  type Group,
  type GroupMember
} from '@prisma/client';
import { randomInt } from 'node:crypto';

import { ErrorCode } from '../../common/http/http-error-code';
import { buildPaginationMeta, resolvePagination } from '../../common/http/pagination';
import { PrismaService } from '../../common/prisma/prisma.service';
import { addUtcDays, toDateOnlyUtc } from '../../common/time/date-only.util';
import { ChoreGenerationService } from '../chores/chore-generation.service';
import { FinanceService } from '../finance/finance.service';
import type { CreateGroupDto } from './dto/create-group.dto';
import type { JoinGroupDto } from './dto/join-group.dto';
import { ListGroupMembersQueryDto } from './dto/list-group-members.query';
import { ListUserGroupsQueryDto } from './dto/list-user-groups.query';
import type { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import type {
  GroupDestroyResponse,
  GroupDashboardResponse,
  GroupMemberLeaveResponse,
  GroupMemberRemoveResponse,
  GroupMemberRoleUpdateResponse,
  GroupMembersResponse,
  GroupSummary,
  JoinCodeResetResponse,
  UserGroupsResponse
} from './interfaces/group-response.interface';

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 8;
const MAX_JOIN_CODE_ATTEMPTS = 12;
const AUDIT_ACTION_MEMBER_ROLE_UPDATED = 'MEMBER_ROLE_UPDATED';
const AUDIT_ACTION_MEMBER_REMOVED = 'MEMBER_REMOVED';
const AUDIT_ACTION_MEMBER_LEFT = 'MEMBER_LEFT';
const NOOP_CHORE_GENERATION_SERVICE = {
  maintainGroupGenerationHorizon: async () => ({
    groupId: '',
    horizonThroughOn: '',
    processedTemplateCount: 0,
    createdOccurrenceCount: 0,
    templates: []
  })
} as unknown as ChoreGenerationService;

interface BlockingChoreAssignmentCounts {
  pendingOccurrenceCount: number;
  activeTemplateCount: number;
  pausedTemplateCount: number;
}

interface BlockingFinanceBalanceSummary {
  currency: string;
  netAmount: number;
}

interface BlockingRemovalDependencies extends BlockingChoreAssignmentCounts {
  financeBalances: BlockingFinanceBalanceSummary[];
}

type MembershipExitAction = 'remove' | 'leave';

interface ActiveGroupCounts {
  activeAdminCount: number;
  activeMemberCount: number;
}

const NOOP_FINANCE_SERVICE = {
  getMemberNetBalancesByCurrency: async () => []
} as unknown as FinanceService;

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly choreGenerationService: ChoreGenerationService = NOOP_CHORE_GENERATION_SERVICE,
    private readonly financeService: FinanceService = NOOP_FINANCE_SERVICE
  ) {}

  async createGroup(
    userId: string,
    payload: CreateGroupDto,
    displayName?: string | null
  ): Promise<GroupSummary> {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: payload.name.trim(),
          createdBy: userId
        }
      });

      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId,
          displayName: displayName ?? null,
          role: GroupMemberRole.ADMIN,
          status: GroupMemberStatus.ACTIVE
        }
      });

      const joinCode = await this.rotateJoinCode(tx, group.id, userId);

      return this.mapGroupSummary(
        group,
        {
          role: GroupMemberRole.ADMIN,
          status: GroupMemberStatus.ACTIVE
        },
        1,
        joinCode
      );
    });
  }

  async listUserGroups(
    userId: string,
    query: ListUserGroupsQueryDto = new ListUserGroupsQueryDto(),
    displayName?: string | null
  ): Promise<UserGroupsResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.backfillDisplayName(tx, userId, displayName);

      const pagination = resolvePagination(query);

      const totalGroups = await tx.groupMember.count({
        where: {
          userId,
          status: GroupMemberStatus.ACTIVE
        }
      });

      const memberships = await tx.groupMember.findMany({
        where: {
          userId,
          status: GroupMemberStatus.ACTIVE
        },
        include: {
          group: {
            include: {
              joinCode: {
                select: { code: true }
              }
            }
          }
        },
        orderBy: this.buildUserGroupsOrderBy(query),
        skip: pagination.skip,
        take: pagination.take
      });

      const groupIds = memberships.map((membership) => membership.groupId);
      const activeMemberCounts =
        groupIds.length === 0
          ? []
          : await tx.groupMember.groupBy({
              by: ['groupId'],
              where: {
                groupId: { in: groupIds },
                status: GroupMemberStatus.ACTIVE
              },
              _count: { _all: true }
            });

      const activeMemberCountByGroupId = new Map(
        activeMemberCounts.map((entry) => [entry.groupId, entry._count._all])
      );

      return {
        groups: memberships.map((membership) =>
          this.mapGroupSummary(
            membership.group,
            membership,
            activeMemberCountByGroupId.get(membership.groupId) ?? 0,
            membership.role === GroupMemberRole.ADMIN ? membership.group.joinCode?.code : undefined
          )
        ),
        pagination: buildPaginationMeta(pagination.page, pagination.pageSize, totalGroups)
      };
    });
  }

  async joinGroup(
    userId: string,
    payload: JoinGroupDto,
    displayName?: string | null
  ): Promise<GroupSummary> {
    const normalizedCode = this.normalizeJoinCode(payload.joinCode);

    return this.prisma.$transaction(async (tx) => {
      const joinCodeRecord = await tx.joinCode.findUnique({
        where: { code: normalizedCode },
        include: { group: true }
      });

      if (!joinCodeRecord) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'Invalid join code.'
        });
      }

      const existingMembership = await tx.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: joinCodeRecord.groupId,
            userId
          }
        }
      });

      let membership: GroupMember;

      if (existingMembership?.status === GroupMemberStatus.ACTIVE) {
        throw new ConflictException({
          code: ErrorCode.Conflict,
          message: 'You are already a member of this group.'
        });
      }

      if (existingMembership) {
        membership = await tx.groupMember.update({
          where: { id: existingMembership.id },
          data: {
            role: GroupMemberRole.MEMBER,
            status: GroupMemberStatus.ACTIVE,
            displayName: displayName ?? existingMembership.displayName,
            joinedAt: new Date()
          }
        });
      } else {
        membership = await tx.groupMember.create({
          data: {
            groupId: joinCodeRecord.groupId,
            userId,
            displayName: displayName ?? null,
            role: GroupMemberRole.MEMBER,
            status: GroupMemberStatus.ACTIVE
          }
        });
      }

      const memberCount = await tx.groupMember.count({
        where: {
          groupId: joinCodeRecord.groupId,
          status: GroupMemberStatus.ACTIVE
        }
      });

      const shouldIncludeJoinCode = membership.role === GroupMemberRole.ADMIN;

      return this.mapGroupSummary(
        joinCodeRecord.group,
        membership,
        memberCount,
        shouldIncludeJoinCode ? joinCodeRecord.code : undefined
      );
    });
  }

  async resetJoinCode(userId: string, groupId: string): Promise<JoinCodeResetResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertAdminMembership(tx, userId, groupId);

      const joinCode = await this.rotateJoinCode(tx, groupId, userId);

      return {
        groupId,
        joinCode
      };
    });
  }

  async getGroup(
    userId: string,
    groupId: string,
    displayName?: string | null
  ): Promise<GroupSummary> {
    return this.prisma.$transaction(async (tx) => {
      await this.backfillDisplayName(tx, userId, displayName);
      const membership = await this.assertActiveMembership(tx, userId, groupId, {
        includeGroup: true
      });

      const memberCount = await tx.groupMember.count({
        where: {
          groupId,
          status: GroupMemberStatus.ACTIVE
        }
      });

      let joinCode: string | undefined;
      if (membership.role === GroupMemberRole.ADMIN) {
        const codeRecord = await tx.joinCode.findUnique({
          where: { groupId },
          select: { code: true }
        });
        joinCode = codeRecord?.code;
      }

      return this.mapGroupSummary(membership.group, membership, memberCount, joinCode);
    });
  }

  async getGroupDashboard(
    userId: string,
    groupId: string,
    displayName?: string | null
  ): Promise<GroupDashboardResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.backfillDisplayName(tx, userId, displayName);
      const membership = await this.assertActiveMembership(tx, userId, groupId, {
        includeGroup: true
      });

      const shouldIncludeJoinCode = membership.role === GroupMemberRole.ADMIN;
      const today = toDateOnlyUtc(new Date());
      const next7Days = addUtcDays(today, 7);

      await this.choreGenerationService.maintainGroupGenerationHorizon(groupId, {
        tx,
        today
      });

      const [
        activeMemberCount,
        activeAdminCount,
        joinCodeRecord,
        overdueChoreCount,
        dueTodayCount,
        dueNext7DaysCount,
        assignedToMeDueNext7DaysCount,
        billCount,
        paymentCount,
        latestBill,
        latestPayment,
        contract
      ] = await Promise.all([
        tx.groupMember.count({
          where: {
            groupId,
            status: GroupMemberStatus.ACTIVE
          }
        }),
        tx.groupMember.count({
          where: {
            groupId,
            status: GroupMemberStatus.ACTIVE,
            role: GroupMemberRole.ADMIN
          }
        }),
        shouldIncludeJoinCode
          ? tx.joinCode.findUnique({
              where: { groupId },
              select: { code: true }
            })
          : Promise.resolve<{ code: string } | null>(null),
        tx.chore.count({
          where: {
            groupId,
            status: ChoreStatus.PENDING,
            dueOn: {
              lt: today
            }
          }
        }),
        tx.chore.count({
          where: {
            groupId,
            status: ChoreStatus.PENDING,
            dueOn: today
          }
        }),
        tx.chore.count({
          where: {
            groupId,
            status: ChoreStatus.PENDING,
            dueOn: {
              gte: today,
              lte: next7Days
            }
          }
        }),
        tx.chore.count({
          where: {
            groupId,
            status: ChoreStatus.PENDING,
            assignedToUserId: userId,
            dueOn: {
              gte: today,
              lte: next7Days
            }
          }
        }),
        tx.bill.count({
          where: { groupId }
        }),
        tx.payment.count({
          where: { groupId }
        }),
        tx.bill.findFirst({
          where: { groupId },
          select: { incurredAt: true },
          orderBy: { incurredAt: 'desc' }
        }),
        tx.payment.findFirst({
          where: { groupId },
          select: { paidAt: true },
          orderBy: { paidAt: 'desc' }
        }),
        tx.contract.findUnique({
          where: { groupId },
          select: {
            draftContent: true,
            publishedVersion: true,
            updatedAt: true
          }
        })
      ]);

      return {
        group: this.mapGroupSummary(
          membership.group,
          membership,
          activeMemberCount,
          shouldIncludeJoinCode ? joinCodeRecord?.code : undefined
        ),
        members: {
          totalActive: activeMemberCount,
          adminCount: activeAdminCount,
          memberCount: Math.max(activeMemberCount - activeAdminCount, 0)
        },
        chores: {
          overdueCount: overdueChoreCount,
          dueTodayCount,
          dueNext7DaysCount,
          assignedToMeDueNext7DaysCount
        },
        finance: {
          billCount,
          paymentCount,
          latestBillIncurredAt: latestBill?.incurredAt.toISOString() ?? null,
          latestPaymentPaidAt: latestPayment?.paidAt.toISOString() ?? null
        },
        contract: {
          hasDraft: (contract?.draftContent.trim().length ?? 0) > 0,
          publishedVersion: contract?.publishedVersion ?? null,
          updatedAt: contract?.updatedAt.toISOString() ?? null
        }
      };
    });
  }

  async getGroupMembers(
    userId: string,
    groupId: string,
    query: ListGroupMembersQueryDto = new ListGroupMembersQueryDto(),
    displayName?: string | null
  ): Promise<GroupMembersResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.backfillDisplayName(tx, userId, displayName);
      await this.assertActiveMembership(tx, userId, groupId);

      const pagination = resolvePagination(query);
      const totalMembers = await tx.groupMember.count({
        where: {
          groupId,
          status: GroupMemberStatus.ACTIVE
        }
      });

      const members = await tx.groupMember.findMany({
        where: {
          groupId,
          status: GroupMemberStatus.ACTIVE
        },
        orderBy: this.buildMemberOrderBy(query),
        skip: pagination.skip,
        take: pagination.take
      });

      return {
        groupId,
        members: members.map((member) => this.mapGroupMemberSummary(member)),
        pagination: buildPaginationMeta(pagination.page, pagination.pageSize, totalMembers)
      };
    });
  }

  async updateMemberRole(
    actorUserId: string,
    groupId: string,
    memberUserId: string,
    payload: UpdateMemberRoleDto
  ): Promise<GroupMemberRoleUpdateResponse> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.assertAdminMembership(tx, actorUserId, groupId);

        if (actorUserId === memberUserId) {
          throw new BadRequestException({
            code: ErrorCode.BadRequest,
            message: 'Use leave-group flow to change your own role.'
          });
        }

        const membership = await tx.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId: memberUserId
            }
          }
        });

        if (!membership || membership.status !== GroupMemberStatus.ACTIVE) {
          throw new NotFoundException({
            code: ErrorCode.NotFound,
            message: 'Active member not found.'
          });
        }

        if (membership.role === payload.role) {
          return {
            groupId,
            userId: membership.userId,
            role: membership.role,
            status: membership.status,
            updatedAt: membership.updatedAt.toISOString()
          };
        }

        if (membership.role === GroupMemberRole.ADMIN && payload.role !== GroupMemberRole.ADMIN) {
          await this.assertNotLastAdmin(tx, groupId);
        }

        const updatedMembership = await tx.groupMember.update({
          where: { id: membership.id },
          data: {
            role: payload.role
          }
        });

        await this.recordAuditLog(tx, {
          groupId,
          actorUserId,
          targetUserId: memberUserId,
          action: AUDIT_ACTION_MEMBER_ROLE_UPDATED,
          details: {
            previousRole: membership.role,
            nextRole: updatedMembership.role
          }
        });

        return {
          groupId,
          userId: updatedMembership.userId,
          role: updatedMembership.role,
          status: updatedMembership.status,
          updatedAt: updatedMembership.updatedAt.toISOString()
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async removeMember(
    actorUserId: string,
    groupId: string,
    memberUserId: string
  ): Promise<GroupMemberRemoveResponse> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.assertAdminMembership(tx, actorUserId, groupId);

        if (actorUserId === memberUserId) {
          throw new BadRequestException({
            code: ErrorCode.BadRequest,
            message: 'Use leave-group flow to remove yourself.'
          });
        }

        const membership = await tx.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId: memberUserId
            }
          }
        });

        if (!membership || membership.status !== GroupMemberStatus.ACTIVE) {
          throw new NotFoundException({
            code: ErrorCode.NotFound,
            message: 'Active member not found.'
          });
        }

        if (membership.role === GroupMemberRole.ADMIN) {
          await this.assertNotLastAdmin(tx, groupId);
        }

        await this.assertNoBlockingMembershipExitDependencies(
          tx,
          groupId,
          memberUserId,
          'remove'
        );

        const updatedMembership = await tx.groupMember.update({
          where: { id: membership.id },
          data: {
            status: GroupMemberStatus.INACTIVE
          }
        });

        await this.recordAuditLog(tx, {
          groupId,
          actorUserId,
          targetUserId: memberUserId,
          action: AUDIT_ACTION_MEMBER_REMOVED,
          details: {
            previousRole: membership.role
          }
        });

        return {
          groupId,
          userId: updatedMembership.userId,
          status: updatedMembership.status,
          removed: true,
          updatedAt: updatedMembership.updatedAt.toISOString()
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async leaveGroup(actorUserId: string, groupId: string): Promise<GroupMemberLeaveResponse> {
    return this.prisma.$transaction(
      async (tx) => {
        const membership = await this.assertActiveMembership(tx, actorUserId, groupId);

        if (membership.role === GroupMemberRole.ADMIN) {
          await this.assertCanAdminLeaveGroup(tx, groupId);
        }

        await this.assertNoBlockingMembershipExitDependencies(tx, groupId, actorUserId, 'leave');

        const updatedMembership = await tx.groupMember.update({
          where: { id: membership.id },
          data: {
            status: GroupMemberStatus.INACTIVE
          }
        });

        await this.recordAuditLog(tx, {
          groupId,
          actorUserId,
          targetUserId: actorUserId,
          action: AUDIT_ACTION_MEMBER_LEFT,
          details: {
            previousRole: membership.role
          }
        });

        return {
          groupId,
          userId: updatedMembership.userId,
          status: updatedMembership.status,
          left: true,
          updatedAt: updatedMembership.updatedAt.toISOString()
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async destroyGroup(actorUserId: string, groupId: string): Promise<GroupDestroyResponse> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.assertAdminMembership(tx, actorUserId, groupId);

        const { activeMemberCount } = await this.getActiveGroupCounts(tx, groupId);
        if (activeMemberCount > 1) {
          throw new ConflictException({
            code: ErrorCode.Conflict,
            message:
              'Only the last remaining active member can destroy this group. Remove or have everyone else leave first.'
          });
        }

        await tx.group.delete({
          where: { id: groupId }
        });

        return {
          groupId,
          destroyed: true
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private async assertNoBlockingMembershipExitDependencies(
    tx: Prisma.TransactionClient,
    groupId: string,
    memberUserId: string,
    action: MembershipExitAction
  ): Promise<void> {
    const blockingDependencies = await this.getBlockingMembershipExitDependencies(
      tx,
      groupId,
      memberUserId
    );

    if (
      blockingDependencies.pendingOccurrenceCount > 0 ||
      blockingDependencies.activeTemplateCount > 0 ||
      blockingDependencies.pausedTemplateCount > 0 ||
      blockingDependencies.financeBalances.length > 0
    ) {
      const hasChoreDependencies =
        blockingDependencies.pendingOccurrenceCount > 0 ||
        blockingDependencies.activeTemplateCount > 0 ||
        blockingDependencies.pausedTemplateCount > 0;
      const hasFinanceDependencies = blockingDependencies.financeBalances.length > 0;

      throw new ConflictException({
        code: ErrorCode.Conflict,
        message: this.buildMembershipExitBlockedMessage(
          action,
          hasChoreDependencies,
          hasFinanceDependencies
        ),
        details: blockingDependencies
      });
    }
  }

  private async getBlockingMembershipExitDependencies(
    tx: Prisma.TransactionClient,
    groupId: string,
    memberUserId: string
  ): Promise<BlockingRemovalDependencies> {
    const [pendingOccurrenceCount, activeTemplateCount, pausedTemplateCount, financeBalances] =
      await Promise.all([
        tx.chore.count({
          where: {
            groupId,
            assignedToUserId: memberUserId,
            status: ChoreStatus.PENDING
          }
        }),
        tx.choreTemplate.count({
          where: {
            groupId,
            status: ChoreTemplateStatus.ACTIVE,
            OR: [
              {
                assignedToUserId: memberUserId
              },
              {
                participants: {
                  some: {
                    userId: memberUserId
                  }
                }
              }
            ]
          }
        }),
        tx.choreTemplate.count({
          where: {
            groupId,
            status: ChoreTemplateStatus.PAUSED,
            OR: [
              {
                assignedToUserId: memberUserId
              },
              {
                participants: {
                  some: {
                    userId: memberUserId
                  }
                }
              }
            ]
          }
        }),
        this.financeService.getMemberNetBalancesByCurrency(tx, groupId, memberUserId)
      ]);

    return {
      pendingOccurrenceCount,
      activeTemplateCount,
      pausedTemplateCount,
      financeBalances
    };
  }

  private buildMembershipExitBlockedMessage(
    action: MembershipExitAction,
    hasChoreDependencies: boolean,
    hasFinanceDependencies: boolean
  ): string {
    if (action === 'leave') {
      if (hasChoreDependencies && hasFinanceDependencies) {
        return 'You cannot leave this group while assigned chore work or unsettled group balances remain. Reassign your chores and settle your balances first.';
      }

      if (hasChoreDependencies) {
        return 'You cannot leave this group while assigned pending chore occurrences or recurring chore templates remain. Reassign them first.';
      }

      return 'You cannot leave this group while you still have unsettled group balances. Settle your balances first.';
    }

    if (hasChoreDependencies && hasFinanceDependencies) {
      return 'Member cannot be removed while assigned chore work or unsettled group balances remain. Reassign chores and settle balances first.';
    }

    if (hasChoreDependencies) {
      return 'Member cannot be removed while assigned pending chore occurrences or recurring chore templates remain. Reassign them first.';
    }

    return 'Member cannot be removed while they still have unsettled group balances. Settle balances first.';
  }

  private async assertActiveMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    groupId: string
  ): Promise<GroupMember>;
  private async assertActiveMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    groupId: string,
    options: { includeGroup: true }
  ): Promise<GroupMember & { group: Group }>;
  private async assertActiveMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    groupId: string,
    options?: { includeGroup?: boolean }
  ): Promise<GroupMember | (GroupMember & { group: Group })> {
    const membership = await tx.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      },
      ...(options?.includeGroup
        ? {
            include: {
              group: true
            }
          }
        : {})
    });

    if (!membership || membership.status !== GroupMemberStatus.ACTIVE) {
      throw new ForbiddenException({
        code: ErrorCode.Forbidden,
        message: 'You do not have access to this group.'
      });
    }

    return membership as GroupMember | (GroupMember & { group: Group });
  }

  private async assertAdminMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    groupId: string
  ): Promise<GroupMember> {
    const membership = await this.assertActiveMembership(tx, userId, groupId);

    if (membership.role !== GroupMemberRole.ADMIN) {
      throw new ForbiddenException({
        code: ErrorCode.Forbidden,
        message: 'Only group admins can perform this action.'
      });
    }

    return membership;
  }

  private async getActiveGroupCounts(
    tx: Prisma.TransactionClient,
    groupId: string
  ): Promise<ActiveGroupCounts> {
    const [activeAdminCount, activeMemberCount] = await Promise.all([
      tx.groupMember.count({
        where: {
          groupId,
          status: GroupMemberStatus.ACTIVE,
          role: GroupMemberRole.ADMIN
        }
      }),
      tx.groupMember.count({
        where: {
          groupId,
          status: GroupMemberStatus.ACTIVE
        }
      })
    ]);

    return {
      activeAdminCount,
      activeMemberCount
    };
  }

  private async assertCanAdminLeaveGroup(
    tx: Prisma.TransactionClient,
    groupId: string
  ): Promise<void> {
    const { activeAdminCount, activeMemberCount } = await this.getActiveGroupCounts(tx, groupId);

    if (activeAdminCount <= 1) {
      throw new ConflictException({
        code: ErrorCode.Conflict,
        message:
          activeMemberCount <= 1
            ? 'You are the last active member in this group. Destroy the group instead of leaving it.'
            : 'Group must have at least one admin. Promote another member to admin before leaving.'
      });
    }
  }

  private async assertNotLastAdmin(tx: Prisma.TransactionClient, groupId: string): Promise<void> {
    const { activeAdminCount } = await this.getActiveGroupCounts(tx, groupId);

    if (activeAdminCount <= 1) {
      throw new ConflictException({
        code: ErrorCode.Conflict,
        message: 'Group must have at least one admin.'
      });
    }
  }

  private async recordAuditLog(
    tx: Prisma.TransactionClient,
    params: {
      groupId: string;
      actorUserId: string;
      targetUserId?: string;
      action: string;
      details?: Record<string, unknown>;
    }
  ): Promise<void> {
    await tx.groupAuditLog.create({
      data: {
        groupId: params.groupId,
        actorUserId: params.actorUserId,
        targetUserId: params.targetUserId,
        action: params.action,
        ...(params.details ? { details: params.details as Prisma.InputJsonValue } : {})
      }
    });
  }

  private async rotateJoinCode(
    tx: Prisma.TransactionClient,
    groupId: string,
    createdBy: string
  ): Promise<string> {
    for (let attempt = 1; attempt <= MAX_JOIN_CODE_ATTEMPTS; attempt += 1) {
      const candidate = this.generateJoinCode();

      try {
        await tx.joinCode.upsert({
          where: { groupId },
          update: {
            code: candidate,
            createdBy
          },
          create: {
            groupId,
            code: candidate,
            createdBy
          }
        });

        return candidate;
      } catch (error) {
        const isUniqueConflict =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

        if (!isUniqueConflict || attempt === MAX_JOIN_CODE_ATTEMPTS) {
          throw error;
        }
      }
    }

    throw new ConflictException({
      code: ErrorCode.Conflict,
      message: 'Unable to generate a unique join code. Please retry.'
    });
  }

  private generateJoinCode(): string {
    return Array.from({ length: JOIN_CODE_LENGTH }, () => {
      const index = randomInt(0, JOIN_CODE_ALPHABET.length);
      return JOIN_CODE_ALPHABET[index];
    }).join('');
  }

  private normalizeJoinCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private async backfillDisplayName(
    tx: Prisma.TransactionClient,
    userId: string,
    displayName?: string | null
  ): Promise<void> {
    if (!displayName) return;
    await tx.groupMember.updateMany({
      where: {
        userId,
        status: GroupMemberStatus.ACTIVE,
        displayName: null
      },
      data: { displayName }
    });
  }

  private mapGroupSummary(
    group: Group,
    membership: Pick<GroupMember, 'role' | 'status'>,
    memberCount: number,
    joinCode?: string
  ): GroupSummary {
    return {
      id: group.id,
      name: group.name,
      createdBy: group.createdBy,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      memberRole: membership.role,
      memberStatus: membership.status,
      memberCount,
      ...(joinCode ? { joinCode } : {})
    };
  }

  private mapGroupMemberSummary(member: GroupMember): GroupMembersResponse['members'][number] {
    return {
      userId: member.userId,
      displayName: member.displayName,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt.toISOString(),
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString()
    };
  }

  private buildMemberOrderBy(
    query: ListGroupMembersQueryDto
  ): Prisma.GroupMemberOrderByWithRelationInput[] {
    switch (query.sortBy) {
      case 'joinedAt':
        return [{ joinedAt: query.sortOrder }, { createdAt: query.sortOrder }];
      case 'createdAt':
        return [{ createdAt: query.sortOrder }, { joinedAt: query.sortOrder }];
      case 'role':
      default:
        return [{ role: query.sortOrder }, { joinedAt: 'asc' }];
    }
  }

  private buildUserGroupsOrderBy(
    query: ListUserGroupsQueryDto
  ): Prisma.GroupMemberOrderByWithRelationInput[] {
    switch (query.sortBy) {
      case 'name':
        return [{ group: { name: query.sortOrder } }, { joinedAt: 'desc' }];
      case 'createdAt':
        return [{ group: { createdAt: query.sortOrder } }, { joinedAt: 'desc' }];
      case 'joinedAt':
        return [{ joinedAt: query.sortOrder }, { createdAt: query.sortOrder }];
      case 'updatedAt':
      default:
        return [{ group: { updatedAt: query.sortOrder } }, { joinedAt: 'desc' }];
    }
  }
}
