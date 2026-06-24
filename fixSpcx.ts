import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    await prisma.company.update({
        where: { symbol: 'SPCX' },
        data: { ipoDate: new Date('2026-06-12') }
    });
    console.log('Zaktualizowano datę IPO dla SPCX w bazie na 2026-06-12');
}

main().finally(() => prisma.$disconnect());
