import { ApiProperty } from '@nestjs/swagger';

export const SUCCESS_RESPONSE_META_EXAMPLE = {
  requestId: 'ad86d8f4-8f30-4383-9534-dbc56f5aa1af',
  timestamp: '2026-03-05T16:06:00.000Z'
} as const;

export class ApiMetaDto {
  @ApiProperty({
    example: SUCCESS_RESPONSE_META_EXAMPLE.requestId
  })
  requestId!: string;

  @ApiProperty({
    example: SUCCESS_RESPONSE_META_EXAMPLE.timestamp,
    format: 'date-time'
  })
  timestamp!: string;
}

export class ApiSuccessEnvelopeDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ type: () => ApiMetaDto })
  meta!: ApiMetaDto;
}
