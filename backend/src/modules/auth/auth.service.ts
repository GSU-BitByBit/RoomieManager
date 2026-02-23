import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ErrorCode } from '../../common/http/http-error-code';
import type { EnvConfig } from '../../config/env.schema';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type {
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

@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  async register(payload: RegisterDto): Promise<AuthResult> {
    const metadata = payload.fullName
      ? {
          full_name: payload.fullName
        }
      : undefined;

    const response = await this.callSupabaseAuth<SupabaseAuthApiResponse>('/auth/v1/signup', {
      email: payload.email,
      password: payload.password,
      ...(metadata ? { data: metadata } : {})
    });

    return this.mapAuthResult(response);
  }

  async login(payload: LoginDto): Promise<AuthResult> {
    const response = await this.callSupabaseAuth<
      SupabaseAuthApiResponse | SupabaseAuthApiTokenResponse
    >('/auth/v1/token?grant_type=password', {
      email: payload.email,
      password: payload.password
    });

    return this.mapAuthResult(response);
  }

  private async callSupabaseAuth<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const supabaseUrl = this.getSupabaseUrl();
    const anonKey = this.getSupabaseAnonKey();

    let response: Response;
    try {
      response = await fetch(`${supabaseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: anonKey,
          authorization: `Bearer ${anonKey}`
        },
        body: JSON.stringify(body)
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

  private getSupabaseUrl(): string {
    const rawUrl = this.configService.get('SUPABASE_URL', { infer: true })?.trim();

    if (!rawUrl) {
      throw new ServiceUnavailableException({
        code: ErrorCode.ServiceUnavailable,
        message: 'SUPABASE_URL is not configured.'
      });
    }

    return rawUrl.replace(/\/+$/, '');
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
    try {
      return await response.json();
    } catch {
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

    const details = {
      status,
      error: errorPayload.error,
      errorCode: errorPayload.error_code,
      rawCode: errorPayload.code
    };

    if (status === 401 || status === 403) {
      return new UnauthorizedException({
        code: ErrorCode.Unauthorized,
        message,
        details
      });
    }

    if (status === 409) {
      return new ConflictException({
        code: ErrorCode.Conflict,
        message,
        details
      });
    }

    if (status >= 400 && status < 500) {
      return new BadRequestException({
        code: ErrorCode.BadRequest,
        message,
        details
      });
    }

    return new ServiceUnavailableException({
      code: ErrorCode.ServiceUnavailable,
      message,
      details
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
