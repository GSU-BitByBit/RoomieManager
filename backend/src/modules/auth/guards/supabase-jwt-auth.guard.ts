import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { ErrorCode } from '../../../common/http/http-error-code';
import { SupabaseJwtService } from '../supabase-jwt.service';
import type { RequestWithAuthenticatedUser } from '../interfaces/auth-user.interface';

@Injectable()
export class SupabaseJwtAuthGuard implements CanActivate {
  constructor(private readonly supabaseJwtService: SupabaseJwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithAuthenticatedUser & { headers?: Record<string, unknown> }>();
    const token = this.extractBearerToken(request.headers?.authorization);

    if (!token) {
      throw new UnauthorizedException({
        code: ErrorCode.Unauthorized,
        message: 'Missing bearer token.'
      });
    }

    request.user = await this.supabaseJwtService.verifyAccessToken(token);
    return true;
  }

  private extractBearerToken(authorizationHeader: unknown): string | null {
    if (typeof authorizationHeader !== 'string') {
      return null;
    }

    const [type, token] = authorizationHeader.split(' ');
    if (!type || !token || type.toLowerCase() !== 'bearer') {
      return null;
    }

    return token.trim() || null;
  }
}
