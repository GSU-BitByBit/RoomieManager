import { GroupMemberRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: GroupMemberRole,
    enumName: 'GroupMemberRole',
    description: 'Target role for the member'
  })
  @IsEnum(GroupMemberRole)
  role!: GroupMemberRole;
}
