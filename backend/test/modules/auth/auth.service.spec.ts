import { ServiceUnavailableException } from '@nestjs/common';

import { AuthService } from '../../../src/modules/auth/auth.service';

describe('AuthService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws when SUPABASE_URL is missing', async () => {
    const configServiceMock = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          SUPABASE_URL: '',
          SUPABASE_ANON_KEY: 'anon-key'
        };

        return values[key];
      })
    };

    const service = new AuthService(configServiceMock as any);

    await expect(
      service.register({ email: 'alex@example.com', password: 'StrongPass123!' })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws when SUPABASE_ANON_KEY is missing', async () => {
    const configServiceMock = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          SUPABASE_URL: 'https://project-ref.supabase.co',
          SUPABASE_ANON_KEY: ''
        };

        return values[key];
      })
    };

    const service = new AuthService(configServiceMock as any);

    await expect(
      service.login({ email: 'alex@example.com', password: 'StrongPass123!' })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps successful login response from Supabase Auth', async () => {
    const configServiceMock = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          SUPABASE_URL: 'https://project-ref.supabase.co',
          SUPABASE_ANON_KEY: 'anon-key'
        };

        return values[key];
      })
    };

    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: 'user-1',
            email: 'alex@example.com',
            email_confirmed_at: '2026-02-23T00:00:00.000Z'
          },
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          token_type: 'bearer'
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );

    global.fetch = fetchMock as any;

    const service = new AuthService(configServiceMock as any);
    const result = await service.login({
      email: 'alex@example.com',
      password: 'StrongPass123!'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      user: {
        id: 'user-1',
        email: 'alex@example.com',
        emailConfirmedAt: '2026-02-23T00:00:00.000Z'
      },
      session: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenType: 'bearer'
      }
    });
  });

  it('passes redirectTo when requesting password recovery', async () => {
    const configServiceMock = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          SUPABASE_URL: 'https://project-ref.supabase.co',
          SUPABASE_ANON_KEY: 'anon-key',
          SUPABASE_AUTH_REDIRECT_URL: 'https://roomiemanager.site/auth/callback'
        };

        return values[key];
      })
    };

    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );

    global.fetch = fetchMock as any;

    const service = new AuthService(configServiceMock as any);
    const result = await service.requestPasswordRecovery({
      email: 'alex@example.com'
    });

    expect(result).toEqual({
      message: 'If an account exists for that email, a recovery link has been sent.'
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://project-ref.supabase.co/auth/v1/recover',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'anon-key',
          authorization: 'Bearer anon-key',
          redirectTo: 'https://roomiemanager.site/auth/callback'
        })
      })
    );
  });

  it('updates password with the caller access token', async () => {
    const configServiceMock = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          SUPABASE_URL: 'https://project-ref.supabase.co',
          SUPABASE_ANON_KEY: 'anon-key'
        };

        return values[key];
      })
    };

    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: 'user-1'
          }
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );

    global.fetch = fetchMock as any;

    const service = new AuthService(configServiceMock as any);
    const result = await service.updatePassword('user-access-token', {
      password: 'NewStrongPass123!'
    });

    expect(result).toEqual({
      message: 'Password updated successfully.'
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://project-ref.supabase.co/auth/v1/user',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          apikey: 'anon-key',
          authorization: 'Bearer user-access-token'
        }),
        body: JSON.stringify({
          password: 'NewStrongPass123!'
        })
      })
    );
  });

  it('maps email action exchange into a RoomieManager auth result', async () => {
    const configServiceMock = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          SUPABASE_URL: 'https://project-ref.supabase.co',
          SUPABASE_ANON_KEY: 'anon-key'
        };

        return values[key];
      })
    };

    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: 'user-1',
            email: 'alex@example.com',
            email_confirmed_at: '2026-02-23T00:00:00.000Z'
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
            token_type: 'bearer'
          }
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );

    global.fetch = fetchMock as any;

    const service = new AuthService(configServiceMock as any);
    const result = await service.exchangeEmailAction({
      tokenHash: 'token-hash',
      type: 'recovery'
    });

    expect(result).toEqual({
      user: {
        id: 'user-1',
        email: 'alex@example.com',
        emailConfirmedAt: '2026-02-23T00:00:00.000Z'
      },
      session: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenType: 'bearer'
      }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://project-ref.supabase.co/auth/v1/verify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          token_hash: 'token-hash',
          type: 'recovery'
        })
      })
    );
  });
});
