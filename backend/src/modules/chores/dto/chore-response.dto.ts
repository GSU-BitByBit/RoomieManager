import { ChoreStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

import { PaginationMetaDto } from '../../../common/http/dto/pagination-meta.dto';

export class ChoreSummaryDto {
  @ApiProperty({ example: 'cm8wa8qgk0004mk6z9s29u0ro' })
  id!: string;

  @ApiProperty({ example: 'cm8z9ab120001mk8z4og1j0e9' })
  groupId!: string;

  @ApiProperty({ type: String, example: 'cm8wa8qgk0004mk6z9s29u0rt', nullable: true })
  templateId!: string | null;

  @ApiProperty({ example: 'Take out trash' })
  title!: string;

  @ApiProperty({
    type: String,
    example: 'Take out kitchen and bathroom trash before 9pm.',
    nullable: true
  })
  description!: string | null;

  @ApiProperty({ enum: ChoreStatus, example: ChoreStatus.PENDING })
  status!: ChoreStatus;

  @ApiProperty({ example: '2026-03-06', format: 'date' })
  dueOn!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  assigneeUserId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  createdBy!: string;

  @ApiProperty({ type: String, example: '550e8400-e29b-41d4-a716-446655440001', nullable: true })
  completedByUserId!: string | null;

  @ApiProperty({
    type: String,
    example: '2026-03-05T16:34:00.000Z',
    format: 'date-time',
    nullable: true
  })
  completedAt!: string | null;

  @ApiProperty({ example: '2026-03-05T16:31:00.000Z', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-05T16:31:00.000Z', format: 'date-time' })
  updatedAt!: string;
}

export class GroupChoresResponseDto {
  @ApiProperty({ example: 'cm8w9z0abc123def456ghi789' })
  groupId!: string;

  @ApiProperty({ type: () => [ChoreSummaryDto] })
  chores!: ChoreSummaryDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class ChoreCalendarOccurrenceDto {
  @ApiProperty({ example: 'cm8wa8qgk0004mk6z9s29u0ro' })
  id!: string;

  @ApiProperty({ type: String, example: 'cm8wa8qgk0004mk6z9s29u0rt', nullable: true })
  templateId!: string | null;

  @ApiProperty({ example: 'Take out trash' })
  title!: string;

  @ApiProperty({
    type: String,
    example: 'Take out kitchen and bathroom trash before 9pm.',
    nullable: true
  })
  description!: string | null;

  @ApiProperty({ example: '2026-03-06', format: 'date' })
  dueOn!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  assigneeUserId!: string;

  @ApiProperty({ enum: ChoreStatus, example: ChoreStatus.PENDING })
  status!: ChoreStatus;

  @ApiProperty({
    type: String,
    example: '2026-03-05T16:34:00.000Z',
    format: 'date-time',
    nullable: true
  })
  completedAt!: string | null;

  @ApiProperty({ type: String, example: '550e8400-e29b-41d4-a716-446655440001', nullable: true })
  completedByUserId!: string | null;
}

export class GroupChoreCalendarResponseDto {
  @ApiProperty({ example: 'cm8w9z0abc123def456ghi789' })
  groupId!: string;

  @ApiProperty({ example: '2026-03-01', format: 'date' })
  start!: string;

  @ApiProperty({ example: '2026-04-26', format: 'date' })
  end!: string;

  @ApiProperty({ type: () => [ChoreCalendarOccurrenceDto] })
  occurrences!: ChoreCalendarOccurrenceDto[];
}
