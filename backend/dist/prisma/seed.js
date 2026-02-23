"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
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
    console.error('Seed failed', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
