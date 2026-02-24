import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { GroupsService } from './groups.service';
import type { GroupSummary, JoinCodeResetResponse } from './interfaces/group-response.interface';

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
}
