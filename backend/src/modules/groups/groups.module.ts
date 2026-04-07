import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ChoresModule } from '../chores/chores.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [AuthModule, ChoresModule],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService]
})
export class GroupsModule {}
