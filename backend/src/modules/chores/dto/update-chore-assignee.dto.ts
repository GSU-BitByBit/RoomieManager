import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateChoreAssigneeDto {
  @ApiProperty({
    example: 'user-uuid',
    description: 'User ID of the active group member who should own this chore.'
  })
  @IsString()
  assigneeUserId!: string;
}
