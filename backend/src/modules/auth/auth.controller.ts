import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';

import { ApiSuccessResponse } from '../../common/http/api-success-response.decorator';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUserDto, AuthResultDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SupabaseJwtAuthGuard } from './guards/supabase-jwt-auth.guard';
import type { AuthResult } from './interfaces/auth-response.interface';
import type { AuthenticatedUser } from './interfaces/auth-user.interface';

const REGISTER_RESULT_EXAMPLE = {
  user: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'alex@example.com',
    emailConfirmedAt: null,
    phone: null,
    createdAt: '2026-03-05T16:10:00.000Z'
  },
  session: null
} as const;

const LOGIN_RESULT_EXAMPLE = {
  user: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'alex@example.com',
    emailConfirmedAt: '2026-03-05T16:11:00.000Z',
    phone: null,
    createdAt: '2026-03-05T16:10:00.000Z'
  },
  session: {
    accessToken: '<jwt-access-token>',
    refreshToken: '<refresh-token>',
    expiresIn: 3600,
    tokenType: 'bearer'
  }
} as const;

const AUTHENTICATED_USER_EXAMPLE = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  email: 'alex@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  appMetadata: {
    provider: 'email'
  },
  userMetadata: {}
} as const;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register account with email/password via Supabase Auth' })
  @ApiBody({ type: RegisterDto })
  @ApiSuccessResponse({
    status: HttpStatus.CREATED,
    description: 'Returns Supabase user and optional session.',
    type: AuthResultDto,
    example: REGISTER_RESULT_EXAMPLE
  })
  async register(@Body() payload: RegisterDto): Promise<AuthResult> {
    return this.authService.register(payload);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password via Supabase Auth' })
  @ApiBody({ type: LoginDto })
  @ApiSuccessResponse({
    description: 'Returns Supabase user and session.',
    type: AuthResultDto,
    example: LOGIN_RESULT_EXAMPLE
  })
  async login(@Body() payload: LoginDto): Promise<AuthResult> {
    return this.authService.login(payload);
  }

  @Get('me')
  @UseGuards(SupabaseJwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Return current authenticated user from access token claims' })
  @ApiSuccessResponse({
    description: 'Authenticated user identity and claims.',
    type: AuthenticatedUserDto,
    example: AUTHENTICATED_USER_EXAMPLE
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getMe(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
