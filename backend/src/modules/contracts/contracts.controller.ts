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
import { ContractsService } from './contracts.service';
import { ListContractVersionsQueryDto } from './dto/list-contract-versions.query';
import { UpdateContractDraftDto } from './dto/update-contract-draft.dto';
import type {
  ContractDetailResponse,
  ContractSummary,
  ContractVersionSummary,
  ContractVersionsResponse
} from './interfaces/contract-response.interface';

@ApiTags('Contracts')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtAuthGuard)
@Controller()
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('groups/:groupId/contract')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the current contract for a group (draft + latest published).' })
  @ApiOkResponse({ description: 'Returns the contract detail.' })
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
  @ApiOkResponse({ description: 'Returns updated contract summary.' })
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
  @ApiCreatedResponse({ description: 'Returns the newly published version.' })
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
  @ApiOkResponse({
    description: 'Returns version history with pagination metadata.',
    schema: {
      example: {
        success: true,
        data: {
          groupId: 'cm8w9z0abc123def456ghi789',
          versions: [
            {
              id: 'cm8wb8l66000fmk6z5nwnk1j5',
              version: 3,
              content: 'Rent due by 5th. Quiet hours after 10PM.',
              publishedBy: '550e8400-e29b-41d4-a716-446655440001',
              createdAt: '2026-03-05T14:44:00.000Z'
            }
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 3,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false
          }
        },
        meta: {
          requestId: '8f9c8a41-26b8-4e53-a35e-64f4db76d79e',
          timestamp: '2026-03-05T14:45:00.000Z'
        }
      }
    }
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
