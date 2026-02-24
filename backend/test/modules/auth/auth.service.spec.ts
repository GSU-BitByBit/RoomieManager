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
});
