import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Rozpoczynam seedowanie bazy danych (MOCK DATA)...');

  // Wyczyść ewentualne stare mocki, żeby zapobiec konfliktom (opcjonalnie, tu pomijamy dla bezpieczeństwa)
  
  // 1. Tworzymy kilka firm
  const companies = [
    { symbol: 'MOCK1', name: 'Mock Super Tech', isActive: true, ipoDate: new Date('2010-01-15') },
    { symbol: 'MOCK2', name: 'Mock Bio Pharma', isActive: true, ipoDate: new Date('2018-06-20') },
    { symbol: 'MOCK3', name: 'Mock Stable Corp', isActive: true, ipoDate: new Date('2005-11-05') },
    { symbol: 'SPCX', name: 'SpaceX New IPO', isActive: true, ipoDate: new Date(new Date().setDate(new Date().getDate() - 30)) },
  ];

  for (const c of companies) {
    await prisma.company.upsert({
      where: { symbol: c.symbol },
      update: {},
      create: c,
    });
  }

  // 2. Dodajemy dane giełdowe dla tych firm z DZISIAJ, tak aby "Dzisiejsze Perełki" je złapały
  const today = new Date();
  
  // MOCK1 spełnia wyśrubowane kryteria skanera (Upside > 35%, CAGR > 20%, Cap > 10B)
  await prisma.stockData.create({
    data: {
      symbol: 'MOCK1',
      date: today,
      price: 150.50,
      marketCap: 25000000000, // 25 mld
      revenueCurrent: 1000000000,
      revenueEstT0: 1200000000,
      revenueEstT2: 1728000000,
      targetConsensus: 210.00,
      
      cagr2YForward: 0.25, // 25% > 20%
      psRatioForward: 15.0,
      psgRatio: 0.6,
      upside: 0.40 // 40% > 35%
    }
  });

  // MOCK2 spełnia jeszcze lepsze kryteria
  await prisma.stockData.create({
    data: {
      symbol: 'MOCK2',
      date: today,
      price: 45.00,
      marketCap: 15000000000, // 15 mld
      revenueCurrent: 500000000,
      revenueEstT0: 700000000,
      revenueEstT2: 1372000000,
      targetConsensus: 70.00,
      
      cagr2YForward: 0.40, // 40%
      psRatioForward: 10.0,
      psgRatio: 0.25,
      upside: 0.55 // 55%
    }
  });

  // MOCK3 - nie spełnia kryteriów (słaby upside, mały wzrost) by sprawdzić czy skaner to odrzuca
  await prisma.stockData.create({
    data: {
      symbol: 'MOCK3',
      date: today,
      price: 100.00,
      marketCap: 50000000000, // 50 mld
      revenueCurrent: 5000000000,
      revenueEstT0: 5200000000,
      revenueEstT2: 5500000000,
      targetConsensus: 105.00,
      
      cagr2YForward: 0.05, // 5% < 20%
      psRatioForward: 8.0,
      psgRatio: 1.6,
      upside: 0.05 // 5% < 35%
    }
  });

  // SPCX (świeże IPO)
  await prisma.stockData.create({
    data: {
      symbol: 'SPCX',
      date: today,
      price: 80.50,
      marketCap: 15000000000, 
      revenueCurrent: 500000000,
      revenueEstT0: 600000000,
      revenueEstT2: 1000000000,
      targetConsensus: 120.00,
      cagr2YForward: 0.30, 
      psRatioForward: 25.0,
      psgRatio: 0.8,
      upside: 0.49
    }
  });

  // Tworzymy też historię (wczoraj) żeby działały wykresy
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await prisma.stockData.create({
    data: {
      symbol: 'MOCK1',
      date: yesterday,
      price: 145.00,
      marketCap: 24000000000,
      revenueCurrent: 1000000000,
      revenueEstT0: 1200000000,
      revenueEstT2: 1728000000,
      targetConsensus: 210.00,
      cagr2YForward: 0.25,
      psRatioForward: 15.0,
      psgRatio: 0.6,
      upside: 0.44
    }
  });

  await prisma.stockData.create({
    data: {
      symbol: 'MOCK2',
      date: yesterday,
      price: 43.00,
      marketCap: 14000000000,
      revenueCurrent: 500000000,
      revenueEstT0: 700000000,
      revenueEstT2: 1372000000,
      targetConsensus: 70.00,
      cagr2YForward: 0.40,
      psRatioForward: 10.0,
      psgRatio: 0.25,
      upside: 0.62
    }
  });

  console.log('Zakończono seedowanie bazy danych!');
}

main()
  .catch((e) => {
    console.error(e);
    // @ts-ignore
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
