import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SupabaseJwtAuthGuard } from './guards/supabase-jwt-auth.guard';
import type { AuthResult } from './interfaces/auth-response.interface';
import type { AuthenticatedUser } from './interfaces/auth-user.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register account with email/password via Supabase Auth' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ description: 'Returns Supabase user and optional session.' })
  async register(@Body() payload: RegisterDto): Promise<AuthResult> {
    return this.authService.register(payload);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password via Supabase Auth' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Returns Supabase user and session.' })
  async login(@Body() payload: LoginDto): Promise<AuthResult> {
    return this.authService.login(payload);
  }

  @Get('me')
  @UseGuards(SupabaseJwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Return current authenticated user from access token claims' })
  @ApiOkResponse({ description: 'Authenticated user identity and claims.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getMe(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
