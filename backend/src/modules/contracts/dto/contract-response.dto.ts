import { ApiProperty } from '@nestjs/swagger';

import { PaginationMetaDto } from '../../../common/http/dto/pagination-meta.dto';

export class ContractSummaryDto {
  @ApiProperty({ example: 'cm8wb6r8u000emk6zubf6s23n' })
  id!: string;

  @ApiProperty({ example: 'cm8z9ab120001mk8z4og1j0e9' })
  groupId!: string;

  @ApiProperty({ example: 'Draft roommate contract content.' })
  draftContent!: string;

  @ApiProperty({ type: Number, example: 2, nullable: true })
  publishedVersion!: number | null;

  @ApiProperty({ type: String, example: '550e8400-e29b-41d4-a716-446655440001', nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ example: '2026-03-05T16:40:00.000Z', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-05T16:43:00.000Z', format: 'date-time' })
  updatedAt!: string;
}

export class ContractVersionSummaryDto {
  @ApiProperty({ example: 'cm8wb8l66000fmk6z5nwnk1j5' })
  id!: string;

  @ApiProperty({ example: 3 })
  version!: number;

  @ApiProperty({ example: 'Published roommate contract v3.' })
  content!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  publishedBy!: string;

  @ApiProperty({ example: '2026-03-05T16:45:00.000Z', format: 'date-time' })
  createdAt!: string;
}

export class ContractDetailResponseDto {
  @ApiProperty({ type: () => ContractSummaryDto })
  contract!: ContractSummaryDto;

  @ApiProperty({ type: String, example: 'Published roommate contract v2.', nullable: true })
  latestPublishedContent!: string | null;
}

export class ContractVersionsResponseDto {
  @ApiProperty({ example: 'cm8w9z0abc123def456ghi789' })
  groupId!: string;

  @ApiProperty({ type: () => [ContractVersionSummaryDto] })
  versions!: ContractVersionSummaryDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
