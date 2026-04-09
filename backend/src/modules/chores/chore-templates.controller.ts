import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';

import { ApiSuccessResponse } from '../../common/http/api-success-response.decorator';
import { ParseAppIdPipe } from '../../common/http/parse-app-id.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtAuthGuard } from '../auth/guards/supabase-jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { ChoreTemplatesService } from './chore-templates.service';
import {
  ChoreTemplateSummaryDto,
  GroupChoreTemplatesResponseDto
} from './dto/chore-template-response.dto';
import { CreateChoreTemplateDto } from './dto/create-chore-template.dto';
import { UpdateChoreTemplateDto } from './dto/update-chore-template.dto';
import type {
  ChoreTemplateSummary,
  GroupChoreTemplatesResponse
} from './interfaces/chore-template-response.interface';

const CHORE_TEMPLATE_EXAMPLE = {
  id: 'cm8wa8qgk0004mk6z9s29u0rt',
  groupId: 'cm8z9ab120001mk8z4og1j0e9',
  title: 'Take out trash',
  description: 'Kitchen and bathroom bins.',
  status: 'ACTIVE',
  startsOn: '2026-03-09',
  endsOn: null,
  repeatEveryDays: 7,
  assignmentStrategy: 'FIXED',
  assigneeUserId: '550e8400-e29b-41d4-a716-446655440002',
  participants: [],
  createdBy: '550e8400-e29b-41d4-a716-446655440001',
  updatedBy: '550e8400-e29b-41d4-a716-446655440001',
  generatedThroughOn: '2026-05-04',
  createdAt: '2026-03-05T16:31:00.000Z',
  updatedAt: '2026-03-05T16:31:00.000Z'
};

const ROUND_ROBIN_TEMPLATE_EXAMPLE = {
  id: 'cm8wa8qgk0004mk6z9s29u0ru',
  groupId: 'cm8z9ab120001mk8z4og1j0e9',
  title: 'Bathroom reset',
  description: 'Rotate the weekly bathroom deep clean.',
  status: 'ACTIVE',
  startsOn: '2026-03-10',
  endsOn: null,
  repeatEveryDays: 7,
  assignmentStrategy: 'ROUND_ROBIN',
  assigneeUserId: null,
  participants: [
    { userId: '550e8400-e29b-41d4-a716-446655440002', sortOrder: 0 },
    { userId: '550e8400-e29b-41d4-a716-446655440003', sortOrder: 1 }
  ],
  createdBy: '550e8400-e29b-41d4-a716-446655440001',
  updatedBy: '550e8400-e29b-41d4-a716-446655440001',
  generatedThroughOn: '2026-05-05',
  createdAt: '2026-03-05T16:31:00.000Z',
  updatedAt: '2026-03-05T16:31:00.000Z'
};

const GROUP_CHORE_TEMPLATES_EXAMPLE = {
  groupId: 'cm8z9ab120001mk8z4og1j0e9',
  templates: [CHORE_TEMPLATE_EXAMPLE, ROUND_ROBIN_TEMPLATE_EXAMPLE]
} as const;

@ApiTags('Chore Templates')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtAuthGuard)
@Controller()
export class ChoreTemplatesController {
  constructor(private readonly choreTemplatesService: ChoreTemplatesService) {}

  @Get('groups/:groupId/chore-templates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List recurring chore templates for a group.' })
  @ApiSuccessResponse({
    description: 'Returns recurring chore templates for the group.',
    type: GroupChoreTemplatesResponseDto,
    example: GROUP_CHORE_TEMPLATES_EXAMPLE
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  listGroupTemplates(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string
  ): Promise<GroupChoreTemplatesResponse> {
    return this.choreTemplatesService.listGroupTemplates(user.id, groupId);
  }

  @Post('groups/:groupId/chore-templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an active recurring chore template.' })
  @ApiBody({ type: CreateChoreTemplateDto })
  @ApiSuccessResponse({
    status: HttpStatus.CREATED,
    description: 'Recurring chore template created successfully.',
    type: ChoreTemplateSummaryDto,
    example: CHORE_TEMPLATE_EXAMPLE
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID or template payload.' })
  @ApiForbiddenResponse({ description: 'Only admins can manage recurring chore templates.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  createTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Body() payload: CreateChoreTemplateDto
  ): Promise<ChoreTemplateSummary> {
    return this.choreTemplatesService.createTemplate(user.id, groupId, payload);
  }

  @Patch('groups/:groupId/chore-templates/:templateId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a recurring chore template.' })
  @ApiBody({ type: UpdateChoreTemplateDto })
  @ApiSuccessResponse({
    description: 'Recurring chore template updated successfully.',
    type: ChoreTemplateSummaryDto,
    example: {
      ...ROUND_ROBIN_TEMPLATE_EXAMPLE,
      title: 'Take out trash and recycling',
      updatedAt: '2026-03-12T09:15:00.000Z'
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid IDs or template payload.' })
  @ApiForbiddenResponse({ description: 'Only admins can manage recurring chore templates.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  updateTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Param('templateId', ParseAppIdPipe) templateId: string,
    @Body() payload: UpdateChoreTemplateDto
  ): Promise<ChoreTemplateSummary> {
    return this.choreTemplatesService.updateTemplate(user.id, groupId, templateId, payload);
  }

  @Post('groups/:groupId/chore-templates/:templateId/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pause a recurring chore template and cancel future pending occurrences.'
  })
  @ApiSuccessResponse({
    description: 'Recurring chore template paused successfully.',
    type: ChoreTemplateSummaryDto,
    example: {
      ...CHORE_TEMPLATE_EXAMPLE,
      status: 'PAUSED',
      updatedAt: '2026-03-12T09:15:00.000Z'
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid IDs.' })
  @ApiForbiddenResponse({ description: 'Only admins can manage recurring chore templates.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  pauseTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Param('templateId', ParseAppIdPipe) templateId: string
  ): Promise<ChoreTemplateSummary> {
    return this.choreTemplatesService.pauseTemplate(user.id, groupId, templateId);
  }

  @Post('groups/:groupId/chore-templates/:templateId/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a recurring chore template and regenerate future occurrences.' })
  @ApiSuccessResponse({
    description: 'Recurring chore template resumed successfully.',
    type: ChoreTemplateSummaryDto,
    example: {
      ...CHORE_TEMPLATE_EXAMPLE,
      status: 'ACTIVE',
      updatedAt: '2026-03-12T09:15:00.000Z'
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid IDs.' })
  @ApiForbiddenResponse({ description: 'Only admins can manage recurring chore templates.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  resumeTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Param('templateId', ParseAppIdPipe) templateId: string
  ): Promise<ChoreTemplateSummary> {
    return this.choreTemplatesService.resumeTemplate(user.id, groupId, templateId);
  }

  @Post('groups/:groupId/chore-templates/:templateId/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Archive a recurring chore template and cancel future pending occurrences.'
  })
  @ApiSuccessResponse({
    description: 'Recurring chore template archived successfully.',
    type: ChoreTemplateSummaryDto,
    example: {
      ...CHORE_TEMPLATE_EXAMPLE,
      status: 'ARCHIVED',
      updatedAt: '2026-03-12T09:15:00.000Z'
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid IDs.' })
  @ApiForbiddenResponse({ description: 'Only admins can manage recurring chore templates.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  archiveTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Param('templateId', ParseAppIdPipe) templateId: string
  ): Promise<ChoreTemplateSummary> {
    return this.choreTemplatesService.archiveTemplate(user.id, groupId, templateId);
  }
}
