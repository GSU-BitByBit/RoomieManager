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
  @ApiCreatedResponse({
    description: 'Returns Supabase user and optional session.',
    schema: {
      example: {
        success: true,
        data: {
          user: {
            id: '550e8400-e29b-41d4-a716-446655440001',
            email: 'alex@example.com',
            emailConfirmedAt: null,
            phone: null,
            createdAt: '2026-03-05T16:10:00.000Z'
          },
          session: null
        },
        meta: {
          requestId: '2c8d9d89-7ee3-4abb-82af-32de3da6e5b8',
          timestamp: '2026-03-05T16:10:00.000Z'
        }
      }
    }
  })
  async register(@Body() payload: RegisterDto): Promise<AuthResult> {
    return this.authService.register(payload);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password via Supabase Auth' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Returns Supabase user and session.',
    schema: {
      example: {
        success: true,
        data: {
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
        },
        meta: {
          requestId: 'b45f50f1-3442-4db5-b7f3-ed25d4f66f1b',
          timestamp: '2026-03-05T16:11:00.000Z'
        }
      }
    }
  })
  async login(@Body() payload: LoginDto): Promise<AuthResult> {
    return this.authService.login(payload);
  }

  @Get('me')
  @UseGuards(SupabaseJwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Return current authenticated user from access token claims' })
  @ApiOkResponse({
    description: 'Authenticated user identity and claims.',
    schema: {
      example: {
        success: true,
        data: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          email: 'alex@example.com',
          aud: 'authenticated',
          role: 'authenticated',
          appMetadata: {
            provider: 'email'
          },
          userMetadata: {}
        },
        meta: {
          requestId: 'd0545267-fbe2-4f3c-9154-5ef5ef3837a8',
          timestamp: '2026-03-05T16:12:00.000Z'
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  getMe(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
