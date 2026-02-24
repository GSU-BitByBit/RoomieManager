import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyOptions } from 'jose';

import { ErrorCode } from '../../common/http/http-error-code';
import type { EnvConfig } from '../../config/env.schema';
import type { AuthenticatedUser } from './interfaces/auth-user.interface';

@Injectable()
export class SupabaseJwtService {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    const supabaseUrl = this.getSupabaseUrl();
    const issuer = `${supabaseUrl}/auth/v1`;
    const audience = this.configService.get('SUPABASE_JWT_AUDIENCE', { infer: true })?.trim();

    const options: JWTVerifyOptions = {
      issuer,
      ...(audience ? { audience } : {})
    };

    try {
      const { payload } = await jwtVerify(token, this.getJwks(supabaseUrl), options);

      if (!payload.sub || typeof payload.sub !== 'string') {
        throw new UnauthorizedException({
          code: ErrorCode.Unauthorized,
          message: 'Access token is missing subject claim.'
        });
      }

      return this.mapPayloadToUser(payload);
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new UnauthorizedException({
        code: ErrorCode.Unauthorized,
        message: 'Invalid or expired access token.'
      });
    }
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

  private getJwks(supabaseUrl: string): ReturnType<typeof createRemoteJWKSet> {
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    }

    return this.jwks;
  }

  private mapPayloadToUser(payload: JWTPayload): AuthenticatedUser {
    return {
      id: payload.sub as string,
      ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
      ...(typeof payload.aud === 'string' ? { aud: payload.aud } : {}),
      ...(typeof payload.role === 'string' ? { role: payload.role } : {}),
      ...(this.asRecord(payload.app_metadata)
        ? { appMetadata: this.asRecord(payload.app_metadata)! }
        : {}),
      ...(this.asRecord(payload.user_metadata)
        ? {
            userMetadata: this.asRecord(payload.user_metadata)!
          }
        : {})
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }
}
