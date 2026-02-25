import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
  Post,
  UseGuards
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtAuthGuard } from '../auth/guards/supabase-jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { GroupsService } from './groups.service';
import type {
  GroupMemberRemoveResponse,
  GroupMemberRoleUpdateResponse,
  GroupMembersResponse,
  GroupSummary,
  JoinCodeResetResponse
} from './interfaces/group-response.interface';

@ApiTags('Groups')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a roommate group. Creator becomes admin.' })
  @ApiBody({ type: CreateGroupDto })
  @ApiOkResponse({ description: 'Group created with admin membership and join code.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  createGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: CreateGroupDto
  ): Promise<GroupSummary> {
    return this.groupsService.createGroup(user.id, payload);
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a group using join code.' })
  @ApiBody({ type: JoinGroupDto })
  @ApiOkResponse({ description: 'Joins group as member and returns group context.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  joinGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: JoinGroupDto
  ): Promise<GroupSummary> {
    return this.groupsService.joinGroup(user.id, payload);
  }

  @Post(':groupId/join-code/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset group join code (admin only).' })
  @ApiOkResponse({ description: 'Returns newly generated join code.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  resetJoinCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string
  ): Promise<JoinCodeResetResponse> {
    return this.groupsService.resetJoinCode(user.id, groupId);
  }

  @Get(':groupId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get group summary for current member.' })
  @ApiOkResponse({ description: 'Returns group metadata and caller membership context.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string
  ): Promise<GroupSummary> {
    return this.groupsService.getGroup(user.id, groupId);
  }

  @Get(':groupId/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List active members in the group.' })
  @ApiOkResponse({ description: 'Returns current group members with roles and statuses.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getGroupMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string
  ): Promise<GroupMembersResponse> {
    return this.groupsService.getGroupMembers(user.id, groupId);
  }

  @Patch(':groupId/members/:userId/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update group member role (admin only).' })
  @ApiBody({ type: UpdateMemberRoleDto })
  @ApiOkResponse({ description: 'Returns updated member role state.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('userId') memberUserId: string,
    @Body() payload: UpdateMemberRoleDto
  ): Promise<GroupMemberRoleUpdateResponse> {
    return this.groupsService.updateMemberRole(user.id, groupId, memberUserId, payload);
  }

  @Delete(':groupId/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove member from group (admin only).' })
  @ApiOkResponse({ description: 'Marks target member as inactive and returns result.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('userId') memberUserId: string
  ): Promise<GroupMemberRemoveResponse> {
    return this.groupsService.removeMember(user.id, groupId, memberUserId);
  }
}
