import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards
} from '@nestjs/common';
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
import { AuthenticatedUserDto, AuthMessageDto, AuthResultDto } from './dto/auth-response.dto';
import { ExchangeEmailActionDto } from './dto/exchange-email-action.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordRecoveryRequestDto } from './dto/password-recovery-request.dto';
import { PasswordUpdateDto } from './dto/password-update.dto';
import { RegisterDto } from './dto/register.dto';
import { SupabaseJwtAuthGuard } from './guards/supabase-jwt-auth.guard';
import type { AuthMessageResult, AuthResult } from './interfaces/auth-response.interface';
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

const AUTH_MESSAGE_EXAMPLE = {
  message: 'If an account exists for that email, a recovery link has been sent.'
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

  @Post('password/recovery')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a password recovery email via Supabase Auth' })
  @ApiBody({ type: PasswordRecoveryRequestDto })
  @ApiSuccessResponse({
    description: 'Returns a generic success message to avoid leaking account existence.',
    type: AuthMessageDto,
    example: AUTH_MESSAGE_EXAMPLE
  })
  async requestPasswordRecovery(
    @Body() payload: PasswordRecoveryRequestDto
  ): Promise<AuthMessageResult> {
    return this.authService.requestPasswordRecovery(payload);
  }

  @Post('email-action/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a Supabase email action token hash for a session'
  })
  @ApiBody({ type: ExchangeEmailActionDto })
  @ApiSuccessResponse({
    description: 'Returns Supabase user and session for email verification or recovery links.',
    type: AuthResultDto,
    example: LOGIN_RESULT_EXAMPLE
  })
  async exchangeEmailAction(@Body() payload: ExchangeEmailActionDto): Promise<AuthResult> {
    return this.authService.exchangeEmailAction(payload);
  }

  @Post('password/update')
  @UseGuards(SupabaseJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update the authenticated user password via Supabase Auth' })
  @ApiBody({ type: PasswordUpdateDto })
  @ApiSuccessResponse({
    description: 'Password updated successfully.',
    type: AuthMessageDto,
    example: {
      message: 'Password updated successfully.'
    }
  })
  async updatePassword(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: PasswordUpdateDto
  ): Promise<AuthMessageResult> {
    return this.authService.updatePassword(this.extractBearerToken(authorization), payload);
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

  private extractBearerToken(header: string | undefined): string {
    if (!header) {
      return '';
    }

    return header.replace(/^Bearer\s+/i, '').trim();
  }
}
