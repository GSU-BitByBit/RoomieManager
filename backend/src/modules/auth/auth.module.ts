import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseJwtAuthGuard } from './guards/supabase-jwt-auth.guard';
import { SupabaseJwtService } from './supabase-jwt.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SupabaseJwtService, SupabaseJwtAuthGuard],
  exports: [AuthService, SupabaseJwtService, SupabaseJwtAuthGuard]
})
export class AuthModule {}
