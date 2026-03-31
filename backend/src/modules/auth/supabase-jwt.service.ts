import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyOptions } from 'jose';

import { ErrorCode } from '../../common/http/http-error-code';
import { resolveSupabaseUrl } from '../../common/supabase/supabase-url.util';
import type { EnvConfig } from '../../config/env.schema';
import type { AuthenticatedUser } from './interfaces/auth-user.interface';

@Injectable()
export class SupabaseJwtService {
  private readonly logger = new Logger(SupabaseJwtService.name);
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
  private audienceWarningLogged = false;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    const supabaseUrl = resolveSupabaseUrl(this.configService);
    const issuer = `${supabaseUrl}/auth/v1`;
    const audience = this.configService.get('SUPABASE_JWT_AUDIENCE', { infer: true })?.trim();

    if (!audience && !this.audienceWarningLogged) {
      this.logger.warn(
        'SUPABASE_JWT_AUDIENCE is not set — audience validation is disabled. ' +
          'Set this variable to harden token verification.'
      );
      this.audienceWarningLogged = true;
    }

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
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException({
        code: ErrorCode.Unauthorized,
        message: 'Invalid or expired access token.'
      });
    }
  }

  private getJwks(supabaseUrl: string): ReturnType<typeof createRemoteJWKSet> {
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    }

    return this.jwks;
  }

  private mapPayloadToUser(payload: JWTPayload): AuthenticatedUser {
    const aud = payload.aud;
    const resolvedAud = typeof aud === 'string' ? aud : Array.isArray(aud) ? aud[0] : undefined;
    const appMetadata = this.asRecord(payload.app_metadata);
    const userMetadata = this.asRecord(payload.user_metadata);

    return {
      id: payload.sub as string,
      ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
      ...(resolvedAud ? { aud: resolvedAud } : {}),
      ...(typeof payload.role === 'string' ? { role: payload.role } : {}),
      ...(appMetadata ? { appMetadata } : {}),
      ...(userMetadata ? { userMetadata } : {})
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }
}
