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
  ApiConflictResponse,
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
import { CreateBillDto } from './dto/create-bill.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  BillSummaryDto,
  GroupBalancesResponseDto,
  GroupBillsResponseDto,
  PaymentSummaryDto
} from './dto/finance-response.dto';
import { ListBillsQueryDto } from './dto/list-bills.query';
import { FinanceService } from './finance.service';
import type {
  BillSummary,
  GroupBalancesResponse,
  GroupBillsResponse,
  PaymentSummary
} from './interfaces/finance-response.interface';

const BILL_EXAMPLE = {
  id: 'cm8wc5rr7000hmk6zx4qedcib',
  groupId: 'cm8z9ab120001mk8z4og1j0e9',
  title: 'Internet bill - March',
  description: 'Monthly ISP payment',
  totalAmount: 76.5,
  currency: 'USD',
  paidByUserId: '550e8400-e29b-41d4-a716-446655440001',
  splitMethod: 'CUSTOM',
  createdBy: '550e8400-e29b-41d4-a716-446655440001',
  incurredAt: '2026-03-05T16:50:00.000Z',
  dueDate: null,
  createdAt: '2026-03-05T16:50:00.000Z',
  updatedAt: '2026-03-05T16:50:00.000Z',
  splits: [
    {
      id: 'cm8wc5rr9000imk6z2jmlf4x4',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      amount: 25.5,
      createdAt: '2026-03-05T16:50:00.000Z'
    }
  ]
} as const;

const GROUP_BILLS_EXAMPLE = {
  groupId: 'cm8w9z0abc123def456ghi789',
  bills: [BILL_EXAMPLE],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  }
} as const;

const PAYMENT_EXAMPLE = {
  id: 'cm8wd2v9w000lmk6zq2q4s7ty',
  groupId: 'cm8z9ab120001mk8z4og1j0e9',
  billId: 'cm8wc5rr7000hmk6zx4qedcib',
  payerUserId: '550e8400-e29b-41d4-a716-446655440002',
  payeeUserId: '550e8400-e29b-41d4-a716-446655440001',
  amount: 25.5,
  currency: 'USD',
  note: 'Paid via Venmo',
  idempotencyKey: 'pay-2026-03-05-001',
  paidAt: '2026-03-05T16:52:00.000Z',
  createdBy: '550e8400-e29b-41d4-a716-446655440002',
  createdAt: '2026-03-05T16:52:00.000Z',
  updatedAt: '2026-03-05T16:52:00.000Z'
} as const;

const GROUP_BALANCES_EXAMPLE = {
  groupId: 'cm8z9ab120001mk8z4og1j0e9',
  balances: [
    {
      currency: 'USD',
      settlements: [
        {
          fromUserId: '550e8400-e29b-41d4-a716-446655440002',
          toUserId: '550e8400-e29b-41d4-a716-446655440001',
          amount: 12.75
        }
      ],
      memberBalances: [
        {
          userId: '550e8400-e29b-41d4-a716-446655440001',
          netAmount: 12.75
        }
      ]
    }
  ]
} as const;

@ApiTags('Finance')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtAuthGuard)
@Controller()
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('groups/:groupId/bills')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a shared bill with explicit custom split rows.',
    description:
      'Bills are collaborative household ledger records. Split rows are always explicit custom amounts; equal splitting is a frontend convenience that still submits custom split rows. dueDate is informational only.'
  })
  @ApiBody({ type: CreateBillDto })
  @ApiSuccessResponse({
    status: HttpStatus.CREATED,
    description: 'Bill created successfully.',
    type: BillSummaryDto,
    example: BILL_EXAMPLE
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID or bill payload.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this group.' })
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
  @ApiSuccessResponse({
    description: 'Returns bill list for the group with pagination metadata.',
    type: GroupBillsResponseDto,
    example: GROUP_BILLS_EXAMPLE
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
  @ApiOperation({
    summary: 'Record an off-platform payment between group members.',
    description:
      'Payments may be recorded by the payer or a group admin. billId is reference-only metadata and does not allocate settlement to a specific bill.'
  })
  @ApiBody({ type: CreatePaymentDto })
  @ApiSuccessResponse({
    status: HttpStatus.CREATED,
    description: 'Payment recorded successfully.',
    type: PaymentSummaryDto,
    example: PAYMENT_EXAMPLE
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID or payment payload.' })
  @ApiConflictResponse({
    description:
      'Idempotency key was reused for a different canonical payment payload or another finance conflict occurred.'
  })
  @ApiForbiddenResponse({
    description:
      'Caller is not an active member of this group or is not allowed to record this payment.'
  })
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
  @ApiOperation({
    summary: 'Compute and return current net balances for the group.',
    description:
      'Balances are derived from the append-only finance ledger per currency. Settlement suggestions are advisory recommendations, not authoritative allocations.'
  })
  @ApiSuccessResponse({
    description: 'Returns current balances and advisory settlement suggestions for the group.',
    type: GroupBalancesResponseDto,
    example: GROUP_BALANCES_EXAMPLE
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID format.' })
  @ApiForbiddenResponse({ description: 'Caller is not an active member of this group.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseAppIdPipe) groupId: string
  ): Promise<GroupBalancesResponse> {
    return this.financeService.getBalances(user.id, groupId);
  }
}
