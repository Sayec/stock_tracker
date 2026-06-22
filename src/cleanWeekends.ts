import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Rozpoczynam skanowanie bazy danych w poszukiwaniu rekordów z weekendu...');
    const allData = await prisma.stockData.findMany();
    let deletedCount = 0;
    
    for (const record of allData) {
        // getDay() zwraca 0 dla Niedzieli i 6 dla Soboty
        const day = record.date.getDay(); 
        
        if (day === 0 || day === 6) {
            await prisma.stockData.delete({
                where: {
                    symbol_date: {
                        symbol: record.symbol,
                        date: record.date
                    }
                }
            });
            deletedCount++;
        }
    }
    
    console.log(`Zakończono sprzątanie! Usunięto ${deletedCount} nadmiarowych rekordów z weekendu.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
