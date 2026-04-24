import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class PasswordRecoveryRequestDto {
  @ApiProperty({ example: 'alex@example.com' })
  @IsEmail()
  email!: string;
}
