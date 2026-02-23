import { UnauthorizedException, createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { ErrorCode } from '../../../common/http/http-error-code';
import type {
  AuthenticatedUser,
  RequestWithAuthenticatedUser
} from '../interfaces/auth-user.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithAuthenticatedUser>();

    if (!request.user) {
      throw new UnauthorizedException({
        code: ErrorCode.Unauthorized,
        message: 'Missing authenticated user context.'
      });
    }

    return request.user;
  }
);
