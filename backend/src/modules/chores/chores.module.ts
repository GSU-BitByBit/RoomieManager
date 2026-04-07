import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ChoreTemplatesController } from './chore-templates.controller';
import { ChoreGenerationService } from './chore-generation.service';
import { ChoreTemplatesService } from './chore-templates.service';
import { ChoresController } from './chores.controller';
import { ChoresService } from './chores.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ChoreTemplatesController, ChoresController],
  providers: [ChoreGenerationService, ChoreTemplatesService, ChoresService],
  exports: [ChoreGenerationService, ChoreTemplatesService, ChoresService]
})
export class ChoresModule {}
