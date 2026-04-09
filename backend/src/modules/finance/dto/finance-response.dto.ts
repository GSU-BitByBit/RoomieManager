import { ApiProperty } from '@nestjs/swagger';

import { PaginationMetaDto } from '../../../common/http/dto/pagination-meta.dto';

export class BillSplitSummaryDto {
  @ApiProperty({ example: 'cm8wc5rr9000imk6z2jmlf4x4' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  userId!: string;

  @ApiProperty({ example: 25.5 })
  amount!: number;

  @ApiProperty({ example: '2026-03-05T16:50:00.000Z', format: 'date-time' })
  createdAt!: string;
}

export class BillSummaryDto {
  @ApiProperty({ example: 'cm8wc5rr7000hmk6zx4qedcib' })
  id!: string;

  @ApiProperty({ example: 'cm8z9ab120001mk8z4og1j0e9' })
  groupId!: string;

  @ApiProperty({ example: 'Internet bill - March' })
  title!: string;

  @ApiProperty({ type: String, example: 'Monthly ISP payment', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 76.5 })
  totalAmount!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  paidByUserId!: string;

  @ApiProperty({
    enum: ['CUSTOM'],
    example: 'CUSTOM',
    description:
      'Always CUSTOM in the current backend. Equal splitting is a frontend convenience that submits explicit custom split rows.'
  })
  splitMethod!: 'CUSTOM';

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  createdBy!: string;

  @ApiProperty({ example: '2026-03-05T16:50:00.000Z', format: 'date-time' })
  incurredAt!: string;

  @ApiProperty({
    type: String,
    example: null,
    format: 'date-time',
    nullable: true,
    description:
      'Optional informational due date. It is not currently used for balance math, reminders, or settlement logic.'
  })
  dueDate!: string | null;

  @ApiProperty({ example: '2026-03-05T16:50:00.000Z', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-05T16:50:00.000Z', format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: () => [BillSplitSummaryDto] })
  splits!: BillSplitSummaryDto[];
}

export class GroupBillsResponseDto {
  @ApiProperty({ example: 'cm8w9z0abc123def456ghi789' })
  groupId!: string;

  @ApiProperty({ type: () => [BillSummaryDto] })
  bills!: BillSummaryDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class PaymentSummaryDto {
  @ApiProperty({ example: 'cm8wd2v9w000lmk6zq2q4s7ty' })
  id!: string;

  @ApiProperty({ example: 'cm8z9ab120001mk8z4og1j0e9' })
  groupId!: string;

  @ApiProperty({ type: String, example: 'cm8wc5rr7000hmk6zx4qedcib', nullable: true })
  billId!: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  payerUserId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  payeeUserId!: string;

  @ApiProperty({ example: 25.5 })
  amount!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ type: String, example: 'Paid via Venmo', nullable: true })
  note!: string | null;

  @ApiProperty({ type: String, example: 'pay-2026-03-05-001', nullable: true })
  idempotencyKey!: string | null;

  @ApiProperty({ example: '2026-03-05T16:52:00.000Z', format: 'date-time' })
  paidAt!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  createdBy!: string;

  @ApiProperty({ example: '2026-03-05T16:52:00.000Z', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-05T16:52:00.000Z', format: 'date-time' })
  updatedAt!: string;
}

export class SettlementSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  fromUserId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  toUserId!: string;

  @ApiProperty({ example: 12.75 })
  amount!: number;
}

export class MemberBalanceSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  userId!: string;

  @ApiProperty({ example: 12.75 })
  netAmount!: number;
}

export class CurrencyBalanceSummaryDto {
  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({
    type: () => [SettlementSummaryDto],
    description: 'Advisory settlement suggestions derived from current net balances.'
  })
  settlements!: SettlementSummaryDto[];

  @ApiProperty({ type: () => [MemberBalanceSummaryDto] })
  memberBalances!: MemberBalanceSummaryDto[];
}

export class GroupBalancesResponseDto {
  @ApiProperty({ example: 'cm8z9ab120001mk8z4og1j0e9' })
  groupId!: string;

  @ApiProperty({ type: () => [CurrencyBalanceSummaryDto] })
  balances!: CurrencyBalanceSummaryDto[];
}
