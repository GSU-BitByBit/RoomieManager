import { ChoreTemplateAssignmentStrategy, ChoreTemplateStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class ChoreTemplateParticipantSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  userId!: string;

  @ApiProperty({ example: 0, minimum: 0 })
  sortOrder!: number;
}

export class ChoreTemplateSummaryDto {
  @ApiProperty({ example: 'cm8wa8qgk0004mk6z9s29u0rt' })
  id!: string;

  @ApiProperty({ example: 'cm8z9ab120001mk8z4og1j0e9' })
  groupId!: string;

  @ApiProperty({ example: 'Take out trash' })
  title!: string;

  @ApiProperty({ type: String, example: 'Kitchen and bathroom bins.', nullable: true })
  description!: string | null;

  @ApiProperty({ enum: ChoreTemplateStatus, example: ChoreTemplateStatus.ACTIVE })
  status!: ChoreTemplateStatus;

  @ApiProperty({
    enum: ChoreTemplateAssignmentStrategy,
    example: ChoreTemplateAssignmentStrategy.FIXED
  })
  assignmentStrategy!: ChoreTemplateAssignmentStrategy;

  @ApiProperty({ example: '2026-03-09', format: 'date' })
  startsOn!: string;

  @ApiProperty({ type: String, example: '2026-06-29', format: 'date', nullable: true })
  endsOn!: string | null;

  @ApiProperty({ example: 7, minimum: 1 })
  repeatEveryDays!: number;

  @ApiProperty({ type: String, example: '550e8400-e29b-41d4-a716-446655440002', nullable: true })
  assigneeUserId!: string | null;

  @ApiProperty({ type: () => [ChoreTemplateParticipantSummaryDto] })
  participants!: ChoreTemplateParticipantSummaryDto[];

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  createdBy!: string;

  @ApiProperty({ type: String, example: '550e8400-e29b-41d4-a716-446655440001', nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, example: '2026-05-04', format: 'date', nullable: true })
  generatedThroughOn!: string | null;

  @ApiProperty({ example: '2026-03-05T16:31:00.000Z', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-05T16:31:00.000Z', format: 'date-time' })
  updatedAt!: string;
}

export class GroupChoreTemplatesResponseDto {
  @ApiProperty({ example: 'cm8z9ab120001mk8z4og1j0e9' })
  groupId!: string;

  @ApiProperty({ type: () => [ChoreTemplateSummaryDto] })
  templates!: ChoreTemplateSummaryDto[];
}
