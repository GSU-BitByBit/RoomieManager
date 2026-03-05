import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  GroupMemberRole,
  GroupMemberStatus,
  Prisma,
  type Contract,
  type ContractVersion,
  type GroupMember
} from '@prisma/client';

import { ErrorCode } from '../../common/http/http-error-code';
import { buildPaginationMeta, resolvePagination } from '../../common/http/pagination';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ListContractVersionsQueryDto } from './dto/list-contract-versions.query';
import type { UpdateContractDraftDto } from './dto/update-contract-draft.dto';
import type {
  ContractDetailResponse,
  ContractSummary,
  ContractVersionSummary,
  ContractVersionsResponse
} from './interfaces/contract-response.interface';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async getContract(userId: string, groupId: string): Promise<ContractDetailResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertActiveMembership(tx, userId, groupId);

      const contract = await tx.contract.findUnique({
        where: { groupId }
      });

      if (!contract) {
        return {
          contract: {
            id: '',
            groupId,
            draftContent: '',
            publishedVersion: null,
            updatedBy: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          latestPublishedContent: null
        };
      }

      let latestPublishedContent: string | null = null;
      if (contract.publishedVersion !== null) {
        const latest = await tx.contractVersion.findFirst({
          where: { contractId: contract.id },
          orderBy: { version: 'desc' }
        });
        latestPublishedContent = latest?.content ?? null;
      }

      return {
        contract: this.mapContractSummary(contract),
        latestPublishedContent
      };
    });
  }

  async updateDraft(
    actorUserId: string,
    groupId: string,
    payload: UpdateContractDraftDto
  ): Promise<ContractSummary> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.assertActiveMembership(tx, actorUserId, groupId);

      if (membership.role !== GroupMemberRole.ADMIN) {
        throw new ForbiddenException({
          code: ErrorCode.Forbidden,
          message: 'Only admins can edit the group contract.'
        });
      }

      const contract = await tx.contract.upsert({
        where: { groupId },
        create: {
          groupId,
          draftContent: payload.content,
          updatedBy: actorUserId
        },
        update: {
          draftContent: payload.content,
          updatedBy: actorUserId
        }
      });

      return this.mapContractSummary(contract);
    });
  }

  async publishVersion(actorUserId: string, groupId: string): Promise<ContractVersionSummary> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.assertActiveMembership(tx, actorUserId, groupId);

      if (membership.role !== GroupMemberRole.ADMIN) {
        throw new ForbiddenException({
          code: ErrorCode.Forbidden,
          message: 'Only admins can publish the group contract.'
        });
      }

      const contract = await tx.contract.findUnique({
        where: { groupId }
      });

      if (!contract || contract.draftContent.trim().length === 0) {
        throw new BadRequestException({
          code: ErrorCode.BadRequest,
          message: 'Cannot publish an empty contract. Write a draft first.'
        });
      }

      const nextVersion = (contract.publishedVersion ?? 0) + 1;

      const version = await tx.contractVersion.create({
        data: {
          groupId,
          contractId: contract.id,
          version: nextVersion,
          content: contract.draftContent,
          publishedBy: actorUserId
        }
      });

      await tx.contract.update({
        where: { id: contract.id },
        data: { publishedVersion: nextVersion }
      });

      return this.mapVersionSummary(version);
    });
  }

  async listVersions(
    userId: string,
    groupId: string,
    query: ListContractVersionsQueryDto = new ListContractVersionsQueryDto()
  ): Promise<ContractVersionsResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertActiveMembership(tx, userId, groupId);
      const pagination = resolvePagination(query);

      const contract = await tx.contract.findUnique({
        where: { groupId }
      });

      if (!contract) {
        return {
          groupId,
          versions: [],
          pagination: buildPaginationMeta(pagination.page, pagination.pageSize, 0)
        };
      }

      const totalVersions = await tx.contractVersion.count({
        where: { contractId: contract.id }
      });

      const versions = await tx.contractVersion.findMany({
        where: { contractId: contract.id },
        orderBy: this.buildVersionOrderBy(query),
        skip: pagination.skip,
        take: pagination.take
      });

      return {
        groupId,
        versions: versions.map((v) => this.mapVersionSummary(v)),
        pagination: buildPaginationMeta(pagination.page, pagination.pageSize, totalVersions)
      };
    });
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

  private mapContractSummary(contract: Contract): ContractSummary {
    return {
      id: contract.id,
      groupId: contract.groupId,
      draftContent: contract.draftContent,
      publishedVersion: contract.publishedVersion,
      updatedBy: contract.updatedBy,
      createdAt: contract.createdAt.toISOString(),
      updatedAt: contract.updatedAt.toISOString()
    };
  }

  private mapVersionSummary(version: ContractVersion): ContractVersionSummary {
    return {
      id: version.id,
      version: version.version,
      content: version.content,
      publishedBy: version.publishedBy,
      createdAt: version.createdAt.toISOString()
    };
  }

  private buildVersionOrderBy(
    query: ListContractVersionsQueryDto
  ): Prisma.ContractVersionOrderByWithRelationInput[] {
    switch (query.sortBy) {
      case 'createdAt':
        return [{ createdAt: query.sortOrder }, { version: query.sortOrder }];
      case 'version':
      default:
        return [{ version: query.sortOrder }, { createdAt: query.sortOrder }];
    }
  }
}
