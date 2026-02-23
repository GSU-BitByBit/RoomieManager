import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FrontendAuthFixture {
  key: string;
  email: string;
  password: string;
  emailConfirmed: boolean;
  role: 'admin' | 'member';
  fullName: string;
}

interface FrontendGroupFixture {
  key: string;
  name: string;
  adminFixtureKey: string;
  memberFixtureKeys: string[];
}

interface SupabaseAdminUser {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
}

const FRONTEND_AUTH_FIXTURES: FrontendAuthFixture[] = [
  {
    key: 'confirmed_user',
    email: 'roomiemanager.confirmed@gmail.com',
    password: 'StrongPass123!',
    emailConfirmed: true,
    role: 'member',
    fullName: 'Confirmed User'
  },
  {
    key: 'unconfirmed_user',
    email: 'roomiemanager.unconfirmed@gmail.com',
    password: 'StrongPass123!',
    emailConfirmed: false,
    role: 'member',
    fullName: 'Unconfirmed User'
  },
  {
    key: 'group_admin_user',
    email: 'roomiemanager.admin@gmail.com',
    password: 'StrongPass123!',
    emailConfirmed: true,
    role: 'admin',
    fullName: 'Group Admin'
  },
  {
    key: 'group_member_user',
    email: 'roomiemanager.member@gmail.com',
    password: 'StrongPass123!',
    emailConfirmed: true,
    role: 'member',
    fullName: 'Group Member'
  }
];

const FRONTEND_GROUP_FIXTURES: FrontendGroupFixture[] = [
  {
    key: 'demo_household',
    name: 'Demo Household',
    adminFixtureKey: 'group_admin_user',
    memberFixtureKeys: ['group_member_user']
  }
];

async function upsertSystemSetting(key: string, value: Prisma.InputJsonValue): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}

function asInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function normalizeSupabaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

function extractUser(payload: unknown): SupabaseAdminUser {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    if (typeof record.id === 'string') {
      return {
        id: record.id,
        ...(typeof record.email === 'string' || record.email === null ? { email: record.email } : {}),
        ...(typeof record.email_confirmed_at === 'string' || record.email_confirmed_at === null
          ? { email_confirmed_at: record.email_confirmed_at }
          : {})
      };
    }

    if (record.user && typeof record.user === 'object') {
      return extractUser(record.user);
    }
  }

  throw new Error('Supabase admin API response did not include a user object.');
}

async function callSupabaseAdmin<T>(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  method: 'GET' | 'POST' | 'PUT',
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const rawText = await response.text();
  const payload = rawText.length > 0 ? JSON.parse(rawText) : {};

  if (!response.ok) {
    const message =
      (payload as Record<string, unknown>).msg ??
      (payload as Record<string, unknown>).message ??
      (payload as Record<string, unknown>).error_description ??
      (payload as Record<string, unknown>).error ??
      `Supabase admin request failed (${response.status}).`;

    throw new Error(`${method} ${path} failed: ${String(message)}`);
  }

  return payload as T;
}

async function ensureSupabaseAuthFixtures(): Promise<{
  mode: 'enabled' | 'skipped';
  reason?: string;
  users: Array<{
    key: string;
    id: string | null;
    email: string;
    emailConfirmed: boolean;
    role: 'admin' | 'member';
  }>;
}> {
  const supabaseUrlRaw = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrlRaw || !serviceRoleKey) {
    return {
      mode: 'skipped',
      reason: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.',
      users: FRONTEND_AUTH_FIXTURES.map((fixture) => ({
        key: fixture.key,
        id: null,
        email: fixture.email,
        emailConfirmed: fixture.emailConfirmed,
        role: fixture.role
      }))
    };
  }

  const supabaseUrl = normalizeSupabaseUrl(supabaseUrlRaw);

  const listResponse = await callSupabaseAdmin<{ users?: unknown[] }>(
    supabaseUrl,
    serviceRoleKey,
    '/auth/v1/admin/users?page=1&per_page=1000',
    'GET'
  );

  const existingUsers = new Map<string, SupabaseAdminUser>();
  for (const entry of listResponse.users ?? []) {
    try {
      const user = extractUser(entry);
      if (typeof user.email === 'string') {
        existingUsers.set(user.email.toLowerCase(), user);
      }
    } catch {
      // Ignore non-user objects from list response.
    }
  }

  const ensuredUsers: Array<{
    key: string;
    id: string | null;
    email: string;
    emailConfirmed: boolean;
    role: 'admin' | 'member';
  }> = [];

  for (const fixture of FRONTEND_AUTH_FIXTURES) {
    const existing = existingUsers.get(fixture.email.toLowerCase());
    let user: SupabaseAdminUser;

    if (existing) {
      const updated = await callSupabaseAdmin<unknown>(
        supabaseUrl,
        serviceRoleKey,
        `/auth/v1/admin/users/${existing.id}`,
        'PUT',
        {
          password: fixture.password,
          email_confirm: fixture.emailConfirmed,
          user_metadata: {
            fixture_key: fixture.key,
            full_name: fixture.fullName,
            fixture_role: fixture.role
          }
        }
      );
      user = extractUser(updated);
    } else {
      const created = await callSupabaseAdmin<unknown>(supabaseUrl, serviceRoleKey, '/auth/v1/admin/users', 'POST', {
        email: fixture.email,
        password: fixture.password,
        email_confirm: fixture.emailConfirmed,
        user_metadata: {
          fixture_key: fixture.key,
          full_name: fixture.fullName,
          fixture_role: fixture.role
        }
      });
      user = extractUser(created);
    }

    ensuredUsers.push({
      key: fixture.key,
      id: user.id,
      email: fixture.email,
      emailConfirmed: fixture.emailConfirmed,
      role: fixture.role
    });
  }

  return {
    mode: 'enabled',
    users: ensuredUsers
  };
}

async function main(): Promise<void> {
  const now = new Date().toISOString();

  await upsertSystemSetting('platform:seed_version', {
    version: 2,
    seededAt: now
  } as Prisma.InputJsonValue);

  const authFixtureSeedResult = await ensureSupabaseAuthFixtures();

  await upsertSystemSetting('fixtures:frontend_auth', {
    generatedAt: now,
    mode: authFixtureSeedResult.mode,
    ...(authFixtureSeedResult.reason ? { reason: authFixtureSeedResult.reason } : {}),
    users: authFixtureSeedResult.users,
    credentials: FRONTEND_AUTH_FIXTURES.map((fixture) => ({
      key: fixture.key,
      email: fixture.email,
      password: fixture.password
    }))
  } as Prisma.InputJsonValue);

  await upsertSystemSetting(
    'fixtures:frontend_groups',
    asInputJsonValue({
      generatedAt: now,
      note: 'Logical fixtures only until group tables are implemented in Module 3.',
      groups: FRONTEND_GROUP_FIXTURES
    })
  );

  // eslint-disable-next-line no-console
  console.log(
    `Seed complete. Auth fixture mode: ${authFixtureSeedResult.mode}${authFixtureSeedResult.reason ? ` (${authFixtureSeedResult.reason})` : ''}`
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
