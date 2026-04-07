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
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';

import { ApiSuccessResponse } from '../../common/http/api-success-response.decorator';
import { resolveAuthIdentityDisplayName } from '../../common/identity/identity-display.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtAuthGuard } from '../auth/guards/supabase-jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { ParseAppIdPipe } from '../../common/http/parse-app-id.pipe';
import { CreateGroupDto } from './dto/create-group.dto';
import {
  GroupDestroyResponseDto,
  GroupDashboardResponseDto,
  GroupMemberLeaveResponseDto,
  GroupMemberRemoveResponseDto,
  GroupMemberRoleUpdateResponseDto,
  GroupMembersResponseDto,
  GroupSummaryDto,
  JoinCodeResetResponseDto,
  UserGroupsResponseDto
} from './dto/group-response.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { ListGroupMembersQueryDto } from './dto/list-group-members.query';
import { ListUserGroupsQueryDto } from './dto/list-user-groups.query';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { GroupsService } from './groups.service';
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

const USER_GROUPS_RESPONSE_EXAMPLE = {
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
} as const;

const CREATED_GROUP_EXAMPLE = {
  id: 'cm8z9ab120001mk8z4og1j0e9',
  name: 'Apartment 12A',
  createdBy: '550e8400-e29b-41d4-a716-446655440001',
  createdAt: '2026-03-05T16:20:00.000Z',
  updatedAt: '2026-03-05T16:20:00.000Z',
  memberRole: 'ADMIN',
  memberStatus: 'ACTIVE',
  memberCount: 1,
  joinCode: 'ABCD1234'
} as const;

const JOINED_GROUP_EXAMPLE = {
  id: 'cm8z9ab120001mk8z4og1j0e9',
  name: 'Apartment 12A',
  createdBy: '550e8400-e29b-41d4-a716-446655440001',
  createdAt: '2026-03-05T16:20:00.000Z',
  updatedAt: '2026-03-05T16:23:00.000Z',
  memberRole: 'MEMBER',
  memberStatus: 'ACTIVE',
  memberCount: 3
} as const;

const GROUP_SUMMARY_EXAMPLE = {
  id: 'cm8z9ab120001mk8z4og1j0e9',
  name: 'Apartment 12A',
  createdBy: '550e8400-e29b-41d4-a716-446655440001',
  createdAt: '2026-03-05T16:20:00.000Z',
  updatedAt: '2026-03-05T16:25:00.000Z',
  memberRole: 'ADMIN',
  memberStatus: 'ACTIVE',
  memberCount: 3,
  joinCode: 'QWER5678'
} as const;

const JOIN_CODE_RESET_EXAMPLE = {
  groupId: 'cm8z9ab120001mk8z4og1j0e9',
  joinCode: 'QWER5678'
} as const;

const GROUP_DASHBOARD_EXAMPLE = {
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
    overdueCount: 1,
    dueTodayCount: 2,
    dueNext7DaysCount: 5,
    assignedToMeDueNext7DaysCount: 2
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
} as const;

const GROUP_MEMBERS_EXAMPLE = {
  groupId: 'cm8w9z0abc123def456ghi789',
  members: [
    {
      userId: '550e8400-e29b-41d4-a716-446655440001',
      displayName: 'Alex Smith',
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
} as const;

const MEMBER_ROLE_UPDATE_EXAMPLE = {
  groupId: 'cm8z9ab120001mk8z4og1j0e9',
  userId: '550e8400-e29b-41d4-a716-446655440002',
  role: 'MEMBER',
  status: 'ACTIVE',
  updatedAt: '2026-03-05T16:27:00.000Z'
} as const;

const MEMBER_REMOVE_EXAMPLE = {
  groupId: 'cm8z9ab120001mk8z4og1j0e9',
  userId: '550e8400-e29b-41d4-a716-446655440002',
  status: 'INACTIVE',
  removed: true,
  updatedAt: '2026-03-05T16:28:00.000Z'
} as const;

const MEMBER_LEAVE_EXAMPLE = {
  groupId: 'cm8z9ab120001mk8z4og1j0e9',
  userId: '550e8400-e29b-41d4-a716-446655440001',
  status: 'INACTIVE',
  left: true,
  updatedAt: '2026-03-05T16:28:00.000Z'
} as const;

const GROUP_DESTROY_EXAMPLE = {
  groupId: 'cm8z9ab120001mk8z4og1j0e9',
  destroyed: true
} as const;

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
  @ApiSuccessResponse({
    description: 'Returns active groups for the current user with pagination metadata.',
    type: UserGroupsResponseDto,
    example: USER_GROUPS_RESPONSE_EXAMPLE
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
  @ApiSuccessResponse({
    status: HttpStatus.CREATED,
    description: 'Group created with admin membership and join code.',
    type: GroupSummaryDto,
    example: CREATED_GROUP_EXAMPLE
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  createGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: CreateGroupDto
  ): Promise<GroupSummary> {
    return this.groupsService.createGroup(user.id, payload, this.resolveDisplayName(user));
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a group using join code.' })
  @ApiBody({ type: JoinGroupDto })
  @ApiSuccessResponse({
    description: 'Joins group as member and returns group context.',
    type: GroupSummaryDto,
    example: JOINED_GROUP_EXAMPLE
  })
  @ApiBadRequestResponse({ description: 'Invalid join code format or code does not exist.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  joinGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: JoinGroupDto
  ): Promise<GroupSummary> {
    return this.groupsService.joinGroup(user.id, payload, this.resolveDisplayName(user));
  }

  @Post(':groupId/join-code/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset group join code (admin only).' })
  @ApiSuccessResponse({
    description: 'Returns newly generated join code.',
    type: JoinCodeResetResponseDto,
    example: JOIN_CODE_RESET_EXAMPLE
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
  @ApiSuccessResponse({
    description: 'Returns group metadata and caller membership context.',
    type: GroupSummaryDto,
    example: GROUP_SUMMARY_EXAMPLE
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
      'Get frontend dashboard aggregates for a group (member/admin counts, actionable chore windows, finance counters, contract status).'
  })
  @ApiSuccessResponse({
    description: 'Returns aggregated group dashboard data for active members.',
    type: GroupDashboardResponseDto,
    example: GROUP_DASHBOARD_EXAMPLE
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
  @ApiSuccessResponse({
    description: 'Returns current group members with roles, statuses, and pagination metadata.',
    type: GroupMembersResponseDto,
    example: GROUP_MEMBERS_EXAMPLE
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
    return this.groupsService.getGroupMembers(
      user.id,
      groupId,
      query,
      this.resolveDisplayName(user)
    );
  }

  @Patch(':groupId/members/:userId/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update group member role (admin only).' })
  @ApiBody({ type: UpdateMemberRoleDto })
  @ApiSuccessResponse({
    description: 'Returns updated member role state.',
    type: GroupMemberRoleUpdateResponseDto,
    example: MEMBER_ROLE_UPDATE_EXAMPLE
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

  @Post(':groupId/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave group as the current active member.' })
  @ApiSuccessResponse({
    description:
      'Marks the caller membership as inactive when they are not the last admin and no blocking chore or finance dependencies remain.',
    type: GroupMemberLeaveResponseDto,
    example: MEMBER_LEAVE_EXAMPLE
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID format.' })
  @ApiConflictResponse({
    description:
      'Leaving is blocked when the caller is the last active admin, still has blocking chore assignments, or still has unsettled finance balances in the group.'
  })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  leaveGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string
  ): Promise<GroupMemberLeaveResponse> {
    return this.groupsService.leaveGroup(user.id, groupId);
  }

  @Delete(':groupId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Destroy group as the sole remaining active admin.' })
  @ApiSuccessResponse({
    description:
      'Deletes the group and all associated records when the caller is the sole remaining active member and an admin.',
    type: GroupDestroyResponseDto,
    example: GROUP_DESTROY_EXAMPLE
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID format.' })
  @ApiConflictResponse({
    description:
      'Destroying is blocked when other active members still remain in the group.'
  })
  @ApiForbiddenResponse({ description: 'Caller is not an active admin of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  destroyGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string
  ): Promise<GroupDestroyResponse> {
    return this.groupsService.destroyGroup(user.id, groupId);
  }

  @Delete(':groupId/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove member from group (admin only).' })
  @ApiSuccessResponse({
    description:
      'Marks target member as inactive and returns result when no blocking chore dependencies remain.',
    type: GroupMemberRemoveResponseDto,
    example: MEMBER_REMOVE_EXAMPLE
  })
  @ApiBadRequestResponse({ description: 'Invalid IDs for group or member.' })
  @ApiConflictResponse({
    description:
      'Removal is blocked when the member is the last admin, still has blocking chore assignments, or still has unsettled finance balances in the group.'
  })
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
    return resolveAuthIdentityDisplayName(user);
  }
}
