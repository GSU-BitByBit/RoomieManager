import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';

import { ApiSuccessResponse } from '../../common/http/api-success-response.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtAuthGuard } from '../auth/guards/supabase-jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { ParseAppIdPipe } from '../../common/http/parse-app-id.pipe';
import { ChoreCalendarQueryDto } from './dto/chore-calendar.query';
import { CreateChoreDto } from './dto/create-chore.dto';
import {
  ChoreSummaryDto,
  GroupChoreCalendarResponseDto,
  GroupChoresResponseDto
} from './dto/chore-response.dto';
import { ListChoresQueryDto } from './dto/list-chores.query';
import { UpdateChoreAssigneeDto } from './dto/update-chore-assignee.dto';
import { ChoresService } from './chores.service';
import type {
  ChoreSummary,
  GroupChoreCalendarResponse,
  GroupChoresResponse
} from './interfaces/chore-response.interface';

const OCCURRENCE_EXAMPLE = {
  id: 'cm8wa8qgk0004mk6z9s29u0ro',
  groupId: 'cm8z9ab120001mk8z4og1j0e9',
  title: 'Take out trash',
  description: null,
  status: 'PENDING',
  dueOn: '2026-03-06',
  assigneeUserId: '550e8400-e29b-41d4-a716-446655440001',
  createdBy: '550e8400-e29b-41d4-a716-446655440001',
  templateId: null,
  completedByUserId: null,
  completedAt: null,
  createdAt: '2026-03-05T16:31:00.000Z',
  updatedAt: '2026-03-05T16:31:00.000Z'
};

const COMPLETED_OCCURRENCE_EXAMPLE = {
  ...OCCURRENCE_EXAMPLE,
  status: 'COMPLETED',
  assigneeUserId: '550e8400-e29b-41d4-a716-446655440002',
  completedByUserId: '550e8400-e29b-41d4-a716-446655440002',
  completedAt: '2026-03-05T16:34:00.000Z',
  updatedAt: '2026-03-05T16:34:00.000Z'
};

const CALENDAR_OCCURRENCE_EXAMPLE = {
  id: OCCURRENCE_EXAMPLE.id,
  templateId: 'cm8wa8qgk0004mk6z9s29u0rt',
  title: OCCURRENCE_EXAMPLE.title,
  description: OCCURRENCE_EXAMPLE.description,
  dueOn: OCCURRENCE_EXAMPLE.dueOn,
  assigneeUserId: OCCURRENCE_EXAMPLE.assigneeUserId,
  status: OCCURRENCE_EXAMPLE.status,
  completedAt: OCCURRENCE_EXAMPLE.completedAt,
  completedByUserId: OCCURRENCE_EXAMPLE.completedByUserId
};

const GROUP_CHORE_CALENDAR_EXAMPLE = {
  groupId: 'cm8w9z0abc123def456ghi789',
  start: '2026-03-01',
  end: '2026-04-26',
  occurrences: [CALENDAR_OCCURRENCE_EXAMPLE]
} as const;

const GROUP_CHORES_EXAMPLE = {
  groupId: 'cm8w9z0abc123def456ghi789',
  chores: [OCCURRENCE_EXAMPLE],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  }
} as const;

@ApiTags('Chores')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtAuthGuard)
@Controller()
export class ChoresController {
  constructor(private readonly choresService: ChoresService) {}

  @Post('groups/:groupId/chores')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a one-off chore occurrence within a group.' })
  @ApiBody({ type: CreateChoreDto })
  @ApiSuccessResponse({
    status: HttpStatus.CREATED,
    description: 'One-off chore occurrence created successfully.',
    type: ChoreSummaryDto,
    example: OCCURRENCE_EXAMPLE
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID or chore payload.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  createChore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Body() payload: CreateChoreDto
  ): Promise<ChoreSummary> {
    return this.choresService.createChore(user.id, groupId, payload);
  }

  @Get('groups/:groupId/chores/calendar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Return a flat, calendar-friendly occurrence list for a required bounded date range.'
  })
  @ApiQuery({
    name: 'start',
    required: true,
    type: String,
    example: '2026-03-01',
    description: 'Inclusive calendar start date (YYYY-MM-DD).'
  })
  @ApiQuery({
    name: 'end',
    required: true,
    type: String,
    example: '2026-04-26',
    description:
      'Inclusive calendar end date (YYYY-MM-DD). Must be on or after start and no more than 56 days later.'
  })
  @ApiSuccessResponse({
    description: 'Returns a flat, dueOn-sorted occurrence list for the requested calendar range.',
    type: GroupChoreCalendarResponseDto,
    example: GROUP_CHORE_CALENDAR_EXAMPLE
  })
  @ApiBadRequestResponse({
    description: 'Invalid group ID or invalid calendar date range.'
  })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getGroupChoreCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Query() query: ChoreCalendarQueryDto
  ): Promise<GroupChoreCalendarResponse> {
    return this.choresService.getGroupChoreCalendar(user.id, groupId, query);
  }

  @Get('groups/:groupId/chores')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List chore occurrences for a group with optional filters.' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'COMPLETED', 'CANCELLED'] })
  @ApiQuery({ name: 'assigneeUserId', required: false })
  @ApiQuery({ name: 'dueOnFrom', required: false, type: String })
  @ApiQuery({ name: 'dueOnTo', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['dueOn', 'createdAt', 'updatedAt', 'status']
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiSuccessResponse({
    description: 'Returns chores for the specified group with pagination metadata.',
    type: GroupChoresResponseDto,
    example: GROUP_CHORES_EXAMPLE
  })
  @ApiBadRequestResponse({
    description: 'Invalid group ID or invalid filter/pagination/sort query values.'
  })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  listGroupChores(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Query() query: ListChoresQueryDto
  ): Promise<GroupChoresResponse> {
    return this.choresService.listGroupChores(user.id, groupId, query);
  }

  @Patch('chores/:occurrenceId/assignee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reassign a chore occurrence to a different active group member.' })
  @ApiBody({ type: UpdateChoreAssigneeDto })
  @ApiSuccessResponse({
    description: 'Returns updated occurrence state.',
    type: ChoreSummaryDto,
    example: {
      ...OCCURRENCE_EXAMPLE,
      assigneeUserId: '550e8400-e29b-41d4-a716-446655440002',
      updatedAt: '2026-03-05T16:33:00.000Z'
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid occurrence ID or payload.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this occurrence group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  updateOccurrenceAssignee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('occurrenceId', ParseAppIdPipe) occurrenceId: string,
    @Body() payload: UpdateChoreAssigneeDto
  ): Promise<ChoreSummary> {
    return this.choresService.updateOccurrenceAssignee(user.id, occurrenceId, payload);
  }

  @Patch('chores/:occurrenceId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a chore occurrence as completed.' })
  @ApiSuccessResponse({
    description: 'Returns updated occurrence state.',
    type: ChoreSummaryDto,
    example: COMPLETED_OCCURRENCE_EXAMPLE
  })
  @ApiBadRequestResponse({ description: 'Invalid occurrence ID.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this occurrence group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  completeOccurrence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('occurrenceId', ParseAppIdPipe) occurrenceId: string
  ): Promise<ChoreSummary> {
    return this.choresService.completeOccurrence(user.id, occurrenceId);
  }
}
