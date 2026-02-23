import { UnauthorizedException } from '@nestjs/common';

import { SupabaseJwtAuthGuard } from '../../../src/modules/auth/guards/supabase-jwt-auth.guard';

describe('SupabaseJwtAuthGuard', () => {
  it('attaches user for valid bearer token', async () => {
    const jwtServiceMock = {
      verifyAccessToken: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'alex@example.com'
      })
    };

    const guard = new SupabaseJwtAuthGuard(jwtServiceMock as any);
    const request = {
      headers: {
        authorization: 'Bearer valid-token'
      }
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as any;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtServiceMock.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect((request as any).user).toEqual({
      id: 'user-1',
      email: 'alex@example.com'
    });
  });

  it('rejects missing authorization header', async () => {
    const jwtServiceMock = {
      verifyAccessToken: jest.fn()
    };

    const guard = new SupabaseJwtAuthGuard(jwtServiceMock as any);
    const request = {
      headers: {}
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as any;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtServiceMock.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects malformed authorization header', async () => {
    const jwtServiceMock = {
      verifyAccessToken: jest.fn()
    };

    const guard = new SupabaseJwtAuthGuard(jwtServiceMock as any);
    const request = {
      headers: {
        authorization: 'Token abc123'
      }
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as any;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtServiceMock.verifyAccessToken).not.toHaveBeenCalled();
  });
});
