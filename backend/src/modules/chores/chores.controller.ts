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
import { CreateChoreDto } from './dto/create-chore.dto';
import { ListChoresQueryDto } from './dto/list-chores.query';
import { UpdateChoreAssigneeDto } from './dto/update-chore-assignee.dto';
import { ChoresService } from './chores.service';
import type { ChoreSummary, GroupChoresResponse } from './interfaces/chore-response.interface';

@ApiTags('Chores')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtAuthGuard)
@Controller()
export class ChoresController {
  constructor(private readonly choresService: ChoresService) {}

  @Post('groups/:groupId/chores')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new chore within a group.' })
  @ApiBody({ type: CreateChoreDto })
  @ApiCreatedResponse({
    description: 'Chore created successfully.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'cm8wa8qgk0004mk6z9s29u0ro',
          groupId: 'cm8z9ab120001mk8z4og1j0e9',
          title: 'Take out trash',
          description: null,
          status: 'PENDING',
          dueDate: '2026-03-06T10:00:00.000Z',
          assignedToUserId: '550e8400-e29b-41d4-a716-446655440001',
          createdBy: '550e8400-e29b-41d4-a716-446655440001',
          completedAt: null,
          createdAt: '2026-03-05T16:31:00.000Z',
          updatedAt: '2026-03-05T16:31:00.000Z'
        },
        meta: {
          requestId: '769f7398-182f-4408-a972-c6de9159d7a2',
          timestamp: '2026-03-05T16:31:00.000Z'
        }
      }
    }
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

  @Get('groups/:groupId/chores')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List chores for a group with optional filters.' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'COMPLETED'] })
  @ApiQuery({ name: 'assigneeUserId', required: false })
  @ApiQuery({ name: 'dueAfter', required: false, type: String })
  @ApiQuery({ name: 'dueBefore', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['dueDate', 'createdAt', 'updatedAt', 'status']
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({
    description: 'Returns chores for the specified group with pagination metadata.',
    schema: {
      example: {
        success: true,
        data: {
          groupId: 'cm8w9z0abc123def456ghi789',
          chores: [
            {
              id: 'cm8wa8qgk0004mk6z9s29u0ro',
              groupId: 'cm8w9z0abc123def456ghi789',
              title: 'Take out trash',
              description: null,
              status: 'PENDING',
              dueDate: '2026-03-06T10:00:00.000Z',
              assignedToUserId: '550e8400-e29b-41d4-a716-446655440001',
              createdBy: '550e8400-e29b-41d4-a716-446655440001',
              completedAt: null,
              createdAt: '2026-03-05T14:42:00.000Z',
              updatedAt: '2026-03-05T14:42:00.000Z'
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
          requestId: 'ac63a2cd-2f6f-4be8-86fc-0d8c91e2e1b7',
          timestamp: '2026-03-05T14:43:00.000Z'
        }
      }
    }
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

  @Patch('chores/:choreId/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign or unassign a chore.' })
  @ApiBody({ type: UpdateChoreAssigneeDto })
  @ApiOkResponse({
    description: 'Returns updated chore state.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'cm8wa8qgk0004mk6z9s29u0ro',
          groupId: 'cm8z9ab120001mk8z4og1j0e9',
          title: 'Take out trash',
          description: null,
          status: 'PENDING',
          dueDate: '2026-03-06T10:00:00.000Z',
          assignedToUserId: '550e8400-e29b-41d4-a716-446655440002',
          createdBy: '550e8400-e29b-41d4-a716-446655440001',
          completedAt: null,
          createdAt: '2026-03-05T16:31:00.000Z',
          updatedAt: '2026-03-05T16:33:00.000Z'
        },
        meta: {
          requestId: '813c795b-8503-4e7d-a05d-c7f5595a00e4',
          timestamp: '2026-03-05T16:33:00.000Z'
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid chore ID or payload.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this chore group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  updateChoreAssignee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('choreId', ParseAppIdPipe) choreId: string,
    @Body() payload: UpdateChoreAssigneeDto
  ): Promise<ChoreSummary> {
    return this.choresService.updateChoreAssignee(user.id, choreId, payload);
  }

  @Patch('chores/:choreId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a chore as completed.' })
  @ApiOkResponse({
    description: 'Returns updated chore state.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'cm8wa8qgk0004mk6z9s29u0ro',
          groupId: 'cm8z9ab120001mk8z4og1j0e9',
          title: 'Take out trash',
          description: null,
          status: 'COMPLETED',
          dueDate: '2026-03-06T10:00:00.000Z',
          assignedToUserId: '550e8400-e29b-41d4-a716-446655440002',
          createdBy: '550e8400-e29b-41d4-a716-446655440001',
          completedAt: '2026-03-05T16:34:00.000Z',
          createdAt: '2026-03-05T16:31:00.000Z',
          updatedAt: '2026-03-05T16:34:00.000Z'
        },
        meta: {
          requestId: 'f8f6506f-74fe-4ca3-80de-d58b2965de4c',
          timestamp: '2026-03-05T16:34:00.000Z'
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid chore ID.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this chore group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  completeChore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('choreId', ParseAppIdPipe) choreId: string
  ): Promise<ChoreSummary> {
    return this.choresService.completeChore(user.id, choreId);
  }
}
