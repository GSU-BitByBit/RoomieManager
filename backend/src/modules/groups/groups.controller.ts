import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtAuthGuard } from '../auth/guards/supabase-jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { ParseAppIdPipe } from '../../common/http/parse-app-id.pipe';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { ListGroupMembersQueryDto } from './dto/list-group-members.query';
import { ListUserGroupsQueryDto } from './dto/list-user-groups.query';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { GroupsService } from './groups.service';
import type {
  GroupDashboardResponse,
  GroupMemberRemoveResponse,
  GroupMemberRoleUpdateResponse,
  GroupMembersResponse,
  GroupSummary,
  JoinCodeResetResponse,
  UserGroupsResponse
} from './interfaces/group-response.interface';

@ApiTags('Groups')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List groups for current active memberships.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['updatedAt', 'createdAt', 'name', 'joinedAt']
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiOkResponse({
    description: 'Returns active groups for the current user with pagination metadata.',
    schema: {
      example: {
        success: true,
        data: {
          groups: [
            {
              id: 'cm8z9ab120001mk8z4og1j0e9',
              name: 'Apartment 12A',
              createdBy: '550e8400-e29b-41d4-a716-446655440001',
              createdAt: '2026-03-05T16:00:00.000Z',
              updatedAt: '2026-03-05T16:05:00.000Z',
              memberRole: 'ADMIN',
              memberStatus: 'ACTIVE',
              memberCount: 3,
              joinCode: 'ABCD1234'
            }
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false
          }
        },
        meta: {
          requestId: 'ad86d8f4-8f30-4383-9534-dbc56f5aa1af',
          timestamp: '2026-03-05T16:06:00.000Z'
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid pagination/sort query values.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  listUserGroups(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListUserGroupsQueryDto
  ): Promise<UserGroupsResponse> {
    return this.groupsService.listUserGroups(user.id, query, this.resolveDisplayName(user));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a roommate group. Creator becomes admin.' })
  @ApiBody({ type: CreateGroupDto })
  @ApiCreatedResponse({
    description: 'Group created with admin membership and join code.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'cm8z9ab120001mk8z4og1j0e9',
          name: 'Apartment 12A',
          createdBy: '550e8400-e29b-41d4-a716-446655440001',
          createdAt: '2026-03-05T16:20:00.000Z',
          updatedAt: '2026-03-05T16:20:00.000Z',
          memberRole: 'ADMIN',
          memberStatus: 'ACTIVE',
          memberCount: 1,
          joinCode: 'ABCD1234'
        },
        meta: {
          requestId: 'db30ad98-b6c2-412e-95ed-14ccf65711d6',
          timestamp: '2026-03-05T16:20:00.000Z'
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  createGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: CreateGroupDto
  ): Promise<GroupSummary> {
    return this.groupsService.createGroup(
      user.id,
      payload,
      this.resolveDisplayName(user)
    );
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a group using join code.' })
  @ApiBody({ type: JoinGroupDto })
  @ApiOkResponse({
    description: 'Joins group as member and returns group context.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'cm8z9ab120001mk8z4og1j0e9',
          name: 'Apartment 12A',
          createdBy: '550e8400-e29b-41d4-a716-446655440001',
          createdAt: '2026-03-05T16:20:00.000Z',
          updatedAt: '2026-03-05T16:23:00.000Z',
          memberRole: 'MEMBER',
          memberStatus: 'ACTIVE',
          memberCount: 3
        },
        meta: {
          requestId: '1a2f802f-226f-4997-a0cd-6a8b2ec5e7fa',
          timestamp: '2026-03-05T16:23:00.000Z'
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid join code format or code does not exist.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  joinGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: JoinGroupDto
  ): Promise<GroupSummary> {
    return this.groupsService.joinGroup(
      user.id,
      payload,
      this.resolveDisplayName(user)
    );
  }

  @Post(':groupId/join-code/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset group join code (admin only).' })
  @ApiOkResponse({
    description: 'Returns newly generated join code.',
    schema: {
      example: {
        success: true,
        data: {
          groupId: 'cm8z9ab120001mk8z4og1j0e9',
          joinCode: 'QWER5678'
        },
        meta: {
          requestId: '5b442e66-a7eb-4d07-9f75-a8016c5ffaf8',
          timestamp: '2026-03-05T16:24:00.000Z'
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID format.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active admin of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  resetJoinCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string
  ): Promise<JoinCodeResetResponse> {
    return this.groupsService.resetJoinCode(user.id, groupId);
  }

  @Get(':groupId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get group summary for current member.' })
  @ApiOkResponse({
    description: 'Returns group metadata and caller membership context.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'cm8z9ab120001mk8z4og1j0e9',
          name: 'Apartment 12A',
          createdBy: '550e8400-e29b-41d4-a716-446655440001',
          createdAt: '2026-03-05T16:20:00.000Z',
          updatedAt: '2026-03-05T16:25:00.000Z',
          memberRole: 'ADMIN',
          memberStatus: 'ACTIVE',
          memberCount: 3,
          joinCode: 'QWER5678'
        },
        meta: {
          requestId: 'd06c632e-6fd4-4f4d-b500-18e7ef0f0548',
          timestamp: '2026-03-05T16:25:00.000Z'
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID format.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string
  ): Promise<GroupSummary> {
    return this.groupsService.getGroup(user.id, groupId, this.resolveDisplayName(user));
  }

  @Get(':groupId/dashboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get frontend dashboard aggregates for a group (member/admin counts, chore counters, finance counters, contract status).'
  })
  @ApiOkResponse({
    description: 'Returns aggregated group dashboard data for active members.',
    schema: {
      example: {
        success: true,
        data: {
          group: {
            id: 'cm8z9ab120001mk8z4og1j0e9',
            name: 'Apartment 12A',
            createdBy: '550e8400-e29b-41d4-a716-446655440001',
            createdAt: '2026-03-05T16:00:00.000Z',
            updatedAt: '2026-03-05T16:05:00.000Z',
            memberRole: 'ADMIN',
            memberStatus: 'ACTIVE',
            memberCount: 3,
            joinCode: 'ABCD1234'
          },
          members: {
            totalActive: 3,
            adminCount: 1,
            memberCount: 2
          },
          chores: {
            pendingCount: 4,
            completedCount: 8,
            overdueCount: 1,
            assignedToMePendingCount: 2
          },
          finance: {
            billCount: 5,
            paymentCount: 7,
            latestBillIncurredAt: '2026-03-05T12:00:00.000Z',
            latestPaymentPaidAt: '2026-03-05T13:00:00.000Z'
          },
          contract: {
            hasDraft: true,
            publishedVersion: 2,
            updatedAt: '2026-03-05T11:00:00.000Z'
          }
        },
        meta: {
          requestId: 'ad86d8f4-8f30-4383-9534-dbc56f5aa1af',
          timestamp: '2026-03-05T16:06:00.000Z'
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID format.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getGroupDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string
  ): Promise<GroupDashboardResponse> {
    return this.groupsService.getGroupDashboard(user.id, groupId, this.resolveDisplayName(user));
  }

  @Get(':groupId/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List active members in the group.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['role', 'joinedAt', 'createdAt'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiOkResponse({
    description: 'Returns current group members with roles, statuses, and pagination metadata.',
    schema: {
      example: {
        success: true,
        data: {
          groupId: 'cm8w9z0abc123def456ghi789',
          members: [
            {
              userId: '550e8400-e29b-41d4-a716-446655440001',
              role: 'ADMIN',
              status: 'ACTIVE',
              joinedAt: '2026-03-05T14:40:00.000Z',
              createdAt: '2026-03-05T14:40:00.000Z',
              updatedAt: '2026-03-05T14:40:00.000Z'
            }
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false
          }
        },
        meta: {
          requestId: 'f073d9ed-7d9f-4902-a8ee-bfca8de3e4ff',
          timestamp: '2026-03-05T14:41:00.000Z'
        }
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'Invalid group ID or invalid pagination/sort query values.'
  })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getGroupMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Query() query: ListGroupMembersQueryDto
  ): Promise<GroupMembersResponse> {
    return this.groupsService.getGroupMembers(user.id, groupId, query, this.resolveDisplayName(user));
  }

  @Patch(':groupId/members/:userId/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update group member role (admin only).' })
  @ApiBody({ type: UpdateMemberRoleDto })
  @ApiOkResponse({
    description: 'Returns updated member role state.',
    schema: {
      example: {
        success: true,
        data: {
          groupId: 'cm8z9ab120001mk8z4og1j0e9',
          userId: '550e8400-e29b-41d4-a716-446655440002',
          role: 'MEMBER',
          status: 'ACTIVE',
          updatedAt: '2026-03-05T16:27:00.000Z'
        },
        meta: {
          requestId: '4e454951-7f8e-4f36-bc65-066a5882f966',
          timestamp: '2026-03-05T16:27:00.000Z'
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid IDs or invalid role payload.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active admin of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) memberUserId: string,
    @Body() payload: UpdateMemberRoleDto
  ): Promise<GroupMemberRoleUpdateResponse> {
    return this.groupsService.updateMemberRole(user.id, groupId, memberUserId, payload);
  }

  @Delete(':groupId/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove member from group (admin only).' })
  @ApiOkResponse({
    description: 'Marks target member as inactive and returns result.',
    schema: {
      example: {
        success: true,
        data: {
          groupId: 'cm8z9ab120001mk8z4og1j0e9',
          userId: '550e8400-e29b-41d4-a716-446655440002',
          status: 'INACTIVE',
          removed: true,
          updatedAt: '2026-03-05T16:28:00.000Z'
        },
        meta: {
          requestId: '7443f4d5-fdfd-4dd5-a6f8-f846ec0ca6a3',
          timestamp: '2026-03-05T16:28:00.000Z'
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid IDs for group or member.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active admin of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) memberUserId: string
  ): Promise<GroupMemberRemoveResponse> {
    return this.groupsService.removeMember(user.id, groupId, memberUserId);
  }

  private resolveDisplayName(user: AuthenticatedUser): string | null {
    const fullName = user.userMetadata?.full_name;
    if (typeof fullName === 'string' && fullName.trim()) {
      return fullName.trim();
    }
    return user.email ?? null;
  }
}
