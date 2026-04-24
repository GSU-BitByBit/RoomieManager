import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ErrorCode } from '../../common/http/http-error-code';
import { resolveSupabaseUrl } from '../../common/supabase/supabase-url.util';
import type { EnvConfig } from '../../config/env.schema';
import type { ExchangeEmailActionDto } from './dto/exchange-email-action.dto';
import type { LoginDto } from './dto/login.dto';
import type { PasswordRecoveryRequestDto } from './dto/password-recovery-request.dto';
import type { PasswordUpdateDto } from './dto/password-update.dto';
import type { RegisterDto } from './dto/register.dto';
import type {
  AuthMessageResult,
  AuthResult,
  AuthSession,
  AuthUserProfile
} from './interfaces/auth-response.interface';
import type {
  SupabaseAuthApiError,
  SupabaseAuthApiResponse,
  SupabaseAuthApiSession,
  SupabaseAuthApiTokenResponse,
  SupabaseAuthApiUser
} from './interfaces/supabase-auth-api.interface';

interface SupabaseAuthRequest {
  path: string;
  method?: 'POST' | 'PUT';
  body?: Record<string, unknown>;
  accessToken?: string;
  redirectTo?: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  async register(payload: RegisterDto): Promise<AuthResult> {
    const metadata = payload.fullName
      ? {
          full_name: payload.fullName
        }
      : undefined;

    const response = await this.callSupabaseAuth<SupabaseAuthApiResponse>({
      path: '/auth/v1/signup',
      body: {
        email: payload.email,
        password: payload.password,
        ...(metadata ? { data: metadata } : {})
      },
      redirectTo: this.getAuthRedirectUrl()
    });

    return this.mapAuthResult(response);
  }

  async login(payload: LoginDto): Promise<AuthResult> {
    const response = await this.callSupabaseAuth<
      SupabaseAuthApiResponse | SupabaseAuthApiTokenResponse
    >({
      path: '/auth/v1/token?grant_type=password',
      body: {
        email: payload.email,
        password: payload.password
      }
    });

    return this.mapAuthResult(response);
  }

  async requestPasswordRecovery(payload: PasswordRecoveryRequestDto): Promise<AuthMessageResult> {
    await this.callSupabaseAuth({
      path: '/auth/v1/recover',
      body: {
        email: payload.email
      },
      redirectTo: this.getAuthRedirectUrl()
    });

    return {
      message: 'If an account exists for that email, a recovery link has been sent.'
    };
  }

  async updatePassword(
    accessToken: string,
    payload: PasswordUpdateDto
  ): Promise<AuthMessageResult> {
    await this.callSupabaseAuth({
      path: '/auth/v1/user',
      method: 'PUT',
      accessToken,
      body: {
        password: payload.password
      }
    });

    return {
      message: 'Password updated successfully.'
    };
  }

  async exchangeEmailAction(payload: ExchangeEmailActionDto): Promise<AuthResult> {
    const response = await this.callSupabaseAuth<
      SupabaseAuthApiResponse | SupabaseAuthApiTokenResponse
    >({
      path: '/auth/v1/verify',
      body: {
        token_hash: payload.tokenHash,
        type: payload.type
      }
    });

    return this.mapAuthResult(response);
  }

  private async callSupabaseAuth<T>({
    path,
    method = 'POST',
    body,
    accessToken,
    redirectTo
  }: SupabaseAuthRequest): Promise<T> {
    const supabaseUrl = resolveSupabaseUrl(this.configService);
    const anonKey = this.getSupabaseAnonKey();
    const headers: Record<string, string> = {
      apikey: anonKey,
      authorization: `Bearer ${accessToken ?? anonKey}`
    };

    if (body) {
      headers['content-type'] = 'application/json';
    }

    if (redirectTo) {
      headers.redirectTo = redirectTo;
    }

    let response: Response;
    try {
      response = await fetch(`${supabaseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (error) {
      throw new ServiceUnavailableException({
        code: ErrorCode.ServiceUnavailable,
        message: 'Unable to reach Supabase Auth service.',
        details: {
          cause: error instanceof Error ? error.message : 'Unknown network error'
        }
      });
    }

    const data = await this.safeJson(response);
    if (!response.ok) {
      throw this.mapSupabaseErrorToHttpException(response.status, data);
    }

    return data as T;
  }

  private getAuthRedirectUrl(): string | undefined {
    const redirectUrl = this.configService
      .get('SUPABASE_AUTH_REDIRECT_URL', { infer: true })
      ?.trim();

    if (!redirectUrl) {
      return undefined;
    }

    return redirectUrl;
  }

  private getSupabaseAnonKey(): string {
    const anonKey = this.configService.get('SUPABASE_ANON_KEY', { infer: true })?.trim();

    if (!anonKey) {
      throw new ServiceUnavailableException({
        code: ErrorCode.ServiceUnavailable,
        message: 'SUPABASE_ANON_KEY is not configured.'
      });
    }

    return anonKey;
  }

  private async safeJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text.trim()) {
      return {};
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      if (response.ok) {
        throw new ServiceUnavailableException({
          code: ErrorCode.ServiceUnavailable,
          message: 'Supabase returned a non-JSON response.'
        });
      }
      return {};
    }
  }

  private mapSupabaseErrorToHttpException(status: number, payload: unknown): Error {
    const errorPayload = this.asSupabaseError(payload);
    const message =
      errorPayload.msg ??
      errorPayload.message ??
      errorPayload.error_description ??
      errorPayload.error ??
      'Supabase Auth request failed.';

    if (status === 401) {
      return new UnauthorizedException({
        code: ErrorCode.Unauthorized,
        message
      });
    }

    if (status === 403) {
      return new ForbiddenException({
        code: ErrorCode.Forbidden,
        message
      });
    }

    if (status === 409) {
      return new ConflictException({
        code: ErrorCode.Conflict,
        message
      });
    }

    if (status >= 400 && status < 500) {
      return new BadRequestException({
        code: ErrorCode.BadRequest,
        message
      });
    }

    return new ServiceUnavailableException({
      code: ErrorCode.ServiceUnavailable,
      message
    });
  }

  private asSupabaseError(payload: unknown): SupabaseAuthApiError {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }

    return payload as SupabaseAuthApiError;
  }

  private mapAuthResult(
    payload: SupabaseAuthApiResponse | SupabaseAuthApiTokenResponse
  ): AuthResult {
    const session = this.extractSession(payload);

    return {
      user: payload.user ? this.mapUser(payload.user) : null,
      session
    };
  }

  private extractSession(
    payload: SupabaseAuthApiResponse | SupabaseAuthApiTokenResponse
  ): AuthSession | null {
    const payloadWithSession = payload as SupabaseAuthApiResponse;
    if (payloadWithSession.session) {
      return this.mapSession(payloadWithSession.session);
    }

    const payloadWithTopLevelToken = payload as SupabaseAuthApiTokenResponse;
    if (
      typeof payloadWithTopLevelToken.access_token === 'string' &&
      typeof payloadWithTopLevelToken.refresh_token === 'string' &&
      typeof payloadWithTopLevelToken.expires_in === 'number' &&
      typeof payloadWithTopLevelToken.token_type === 'string'
    ) {
      return this.mapSession({
        access_token: payloadWithTopLevelToken.access_token,
        refresh_token: payloadWithTopLevelToken.refresh_token,
        expires_in: payloadWithTopLevelToken.expires_in,
        token_type: payloadWithTopLevelToken.token_type
      });
    }

    return null;
  }

  private mapUser(user: SupabaseAuthApiUser): AuthUserProfile {
    return {
      id: user.id,
      ...(user.email ? { email: user.email } : {}),
      ...(user.email_confirmed_at !== undefined
        ? {
            emailConfirmedAt: user.email_confirmed_at
          }
        : {}),
      ...(user.phone !== undefined ? { phone: user.phone } : {}),
      ...(user.created_at !== undefined ? { createdAt: user.created_at } : {})
    };
  }

  private mapSession(session: SupabaseAuthApiSession): AuthSession {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      tokenType: session.token_type
    };
  }
}
