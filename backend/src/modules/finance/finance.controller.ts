import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { CreateBillDto } from './dto/create-bill.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListBillsQueryDto } from './dto/list-bills.query';
import { FinanceService } from './finance.service';
import type {
  BillSummary,
  GroupBalancesResponse,
  GroupBillsResponse,
  PaymentSummary
} from './interfaces/finance-response.interface';

@ApiTags('Finance')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtAuthGuard)
@Controller()
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('groups/:groupId/bills')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a bill and split amounts across group members.' })
  @ApiBody({ type: CreateBillDto })
  @ApiCreatedResponse({ description: 'Bill created successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  createBill(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Body() payload: CreateBillDto
  ): Promise<BillSummary> {
    return this.financeService.createBill(user.id, groupId, payload);
  }

  @Get('groups/:groupId/bills')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List bills for a group.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['incurredAt', 'createdAt', 'totalAmount'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiOkResponse({
    description: 'Returns bill list for the group with pagination metadata.',
    schema: {
      example: {
        success: true,
        data: {
          groupId: 'cm8w9z0abc123def456ghi789',
          bills: [
            {
              id: 'cm8wc5rr7000hmk6zx4qedcib',
              groupId: 'cm8w9z0abc123def456ghi789',
              title: 'Internet bill - March',
              description: 'Monthly ISP payment',
              totalAmount: 76.5,
              currency: 'USD',
              paidByUserId: '550e8400-e29b-41d4-a716-446655440001',
              splitMethod: 'CUSTOM',
              createdBy: '550e8400-e29b-41d4-a716-446655440001',
              incurredAt: '2026-03-05T14:45:00.000Z',
              dueDate: null,
              createdAt: '2026-03-05T14:45:00.000Z',
              updatedAt: '2026-03-05T14:45:00.000Z',
              splits: [
                {
                  id: 'cm8wc5rr9000imk6z2jmlf4x4',
                  userId: '550e8400-e29b-41d4-a716-446655440001',
                  amount: 25.5,
                  createdAt: '2026-03-05T14:45:00.000Z'
                }
              ]
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
          requestId: '25d65b90-2cb4-451d-a2ce-65f27a223944',
          timestamp: '2026-03-05T14:46:00.000Z'
        }
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'Invalid group ID or invalid pagination/sort query values.'
  })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  listBills(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Query() query: ListBillsQueryDto
  ): Promise<GroupBillsResponse> {
    return this.financeService.listBills(user.id, groupId, query);
  }

  @Post('groups/:groupId/payments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a payment between group members.' })
  @ApiBody({ type: CreatePaymentDto })
  @ApiCreatedResponse({ description: 'Payment recorded successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  createPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string,
    @Body() payload: CreatePaymentDto
  ): Promise<PaymentSummary> {
    return this.financeService.createPayment(user.id, groupId, payload);
  }

  @Get('groups/:groupId/balances')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Compute and return net balances (who owes whom) for the group.' })
  @ApiOkResponse({ description: 'Returns current balances for the group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string
  ): Promise<GroupBalancesResponse> {
    return this.financeService.getBalances(user.id, groupId);
  }
}
