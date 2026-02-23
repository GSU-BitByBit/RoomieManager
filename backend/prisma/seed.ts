import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: 'platform:seed_version' },
    update: {
      value: {
        version: 1,
        seededAt: new Date().toISOString()
      }
    },
    create: {
      key: 'platform:seed_version',
      value: {
        version: 1,
        seededAt: new Date().toISOString()
      }
    }
  });
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
