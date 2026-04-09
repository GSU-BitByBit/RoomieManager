import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserProfileDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  id!: string;

  @ApiPropertyOptional({ example: 'alex@example.com' })
  email?: string;

  @ApiPropertyOptional({
    type: String,
    example: '2026-03-05T16:11:00.000Z',
    format: 'date-time',
    nullable: true
  })
  emailConfirmedAt?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: null,
    nullable: true
  })
  phone?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-03-05T16:10:00.000Z',
    format: 'date-time',
    nullable: true
  })
  createdAt?: string | null;
}

export class AuthSessionDto {
  @ApiProperty({ example: '<jwt-access-token>' })
  accessToken!: string;

  @ApiProperty({ example: '<refresh-token>' })
  refreshToken!: string;

  @ApiProperty({ example: 3600 })
  expiresIn!: number;

  @ApiProperty({ example: 'bearer' })
  tokenType!: string;
}

export class AuthResultDto {
  @ApiProperty({
    type: () => AuthUserProfileDto,
    nullable: true
  })
  user!: AuthUserProfileDto | null;

  @ApiProperty({
    type: () => AuthSessionDto,
    nullable: true
  })
  session!: AuthSessionDto | null;
}

export class AuthenticatedUserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  id!: string;

  @ApiPropertyOptional({ example: 'alex@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: 'authenticated' })
  aud?: string;

  @ApiPropertyOptional({ example: 'authenticated' })
  role?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      provider: 'email'
    }
  })
  appMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {}
  })
  userMetadata?: Record<string, unknown>;
}
