import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ChoresController } from './chores.controller';
import { ChoresService } from './chores.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ChoresController],
  providers: [ChoresService],
  exports: [ChoresService]
})
export class ChoresModule {}
