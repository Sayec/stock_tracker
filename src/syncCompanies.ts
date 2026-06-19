import { PrismaClient } from '@prisma/client';
import { getCompaniesScreener } from './apiClient';

const prisma = new PrismaClient();

async function main() {
    console.log('Rozpoczynam pobieranie listy spółek (Screener)...');
    
    try {
        const companies = await getCompaniesScreener();
        console.log(`Pobrano ${companies.length} spółek ze screenera. Trwa zapisywanie do bazy...`);

        let count = 0;
        for (const comp of companies) {
            await prisma.company.upsert({
                where: { symbol: comp.symbol },
                update: {
                    name: comp.companyName,
                    isActive: comp.isActivelyTrading
                },
                create: {
                    symbol: comp.symbol,
                    name: comp.companyName,
                    isActive: comp.isActivelyTrading
                }
            });
            count++;
            if (count % 500 === 0) {
                console.log(`Zapisano ${count} spółek...`);
            }
        }

        console.log(`Zakończono synchronizację spółek. Razem w bazie: ${companies.length}`);
    } catch (err: any) {
        console.error('Błąd podczas synchronizacji spółek:', err.message);
    }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
