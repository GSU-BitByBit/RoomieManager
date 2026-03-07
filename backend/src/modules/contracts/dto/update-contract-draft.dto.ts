import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateContractDraftDto {
  @ApiProperty({
    description: 'New draft content for the group contract.',
    maxLength: 50_000
  })
  @IsString()
  @MaxLength(50_000)
  content!: string;
}
