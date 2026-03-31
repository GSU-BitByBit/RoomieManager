import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateChoreAssigneeDto {
  @ApiPropertyOptional({
    example: 'user-uuid',
    description:
      'User ID of the new assignee. Omit or set to null/undefined to unassign the chore completely.'
  })
  @IsOptional()
  @IsString()
  assigneeUserId?: string;
}
