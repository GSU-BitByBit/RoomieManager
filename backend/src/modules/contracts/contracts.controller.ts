import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
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
import { ContractsService } from './contracts.service';
import {
  ContractDetailResponseDto,
  ContractSummaryDto,
  ContractVersionSummaryDto,
  ContractVersionsResponseDto
} from './dto/contract-response.dto';
import { ListContractVersionsQueryDto } from './dto/list-contract-versions.query';
import { UpdateContractDraftDto } from './dto/update-contract-draft.dto';
import type {
  ContractDetailResponse,
  ContractSummary,
  ContractVersionSummary,
  ContractVersionsResponse
} from './interfaces/contract-response.interface';

const CONTRACT_DETAIL_EXAMPLE = {
  contract: {
    id: 'cm8wb6r8u000emk6zubf6s23n',
    groupId: 'cm8z9ab120001mk8z4og1j0e9',
    draftContent: 'Draft roommate contract content.',
    publishedVersion: 2,
    updatedBy: '550e8400-e29b-41d4-a716-446655440001',
    createdAt: '2026-03-05T16:40:00.000Z',
    updatedAt: '2026-03-05T16:43:00.000Z'
  },
  latestPublishedContent: 'Published roommate contract v2.'
} as const;

const CONTRACT_SUMMARY_EXAMPLE = {
  id: 'cm8wb6r8u000emk6zubf6s23n',
  groupId: 'cm8z9ab120001mk8z4og1j0e9',
  draftContent: 'Updated draft contract text.',
  publishedVersion: 2,
  updatedBy: '550e8400-e29b-41d4-a716-446655440001',
  createdAt: '2026-03-05T16:40:00.000Z',
  updatedAt: '2026-03-05T16:44:00.000Z'
} as const;

const CONTRACT_VERSION_EXAMPLE = {
  id: 'cm8wb8l66000fmk6z5nwnk1j5',
  version: 3,
  content: 'Published roommate contract v3.',
  publishedBy: '550e8400-e29b-41d4-a716-446655440001',
  createdAt: '2026-03-05T16:45:00.000Z'
} as const;

const CONTRACT_VERSIONS_EXAMPLE = {
  groupId: 'cm8w9z0abc123def456ghi789',
  versions: [CONTRACT_VERSION_EXAMPLE],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 3,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  }
} as const;

@ApiTags('Contracts')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtAuthGuard)
@Controller()
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('groups/:groupId/contract')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the current contract for a group (draft + latest published).' })
  @ApiSuccessResponse({
    description: 'Returns the contract detail.',
    type: ContractDetailResponseDto,
    example: CONTRACT_DETAIL_EXAMPLE
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID format.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getContract(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string
  ): Promise<ContractDetailResponse> {
    return this.contractsService.getContract(user.id, groupId);
  }

  @Put('groups/:groupId/contract')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update the contract draft (admin only).' })
  @ApiBody({ type: UpdateContractDraftDto })
  @ApiSuccessResponse({
    description: 'Returns updated contract summary.',
    type: ContractSummaryDto,
    example: CONTRACT_SUMMARY_EXAMPLE
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID or contract draft payload.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active admin of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  updateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Body() payload: UpdateContractDraftDto
  ): Promise<ContractSummary> {
    return this.contractsService.updateDraft(user.id, groupId, payload);
  }

  @Post('groups/:groupId/contract/publish')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publish the current draft as a new version (admin only).' })
  @ApiSuccessResponse({
    status: HttpStatus.CREATED,
    description: 'Returns the newly published version.',
    type: ContractVersionSummaryDto,
    example: CONTRACT_VERSION_EXAMPLE
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID or empty draft content.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active admin of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  publishVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string
  ): Promise<ContractVersionSummary> {
    return this.contractsService.publishVersion(user.id, groupId);
  }

  @Get('groups/:groupId/contract/versions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all published contract versions for a group.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['version', 'createdAt'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiSuccessResponse({
    description: 'Returns version history with pagination metadata.',
    type: ContractVersionsResponseDto,
    example: CONTRACT_VERSIONS_EXAMPLE
  })
  @ApiBadRequestResponse({
    description: 'Invalid group ID or invalid pagination/sort query values.'
  })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  listVersions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Query() query: ListContractVersionsQueryDto
  ): Promise<ContractVersionsResponse> {
    return this.contractsService.listVersions(user.id, groupId, query);
  }
}
