import { PrismaClient } from '@prisma/client';

const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const COMPANIES = [
    { symbol: 'MOCK1', name: 'Mock Super Tech', ipoDate: null, basePrice: 150, basePt: 210, baseCagr: 0.28, basePs: 14.5 },
    { symbol: 'MOCK2', name: 'Mock Bio Pharma', ipoDate: null, basePrice: 45, basePt: 72, baseCagr: 0.42, basePs: 9.8 },
    { symbol: 'MOCK3', name: 'Mock Stable Corp', ipoDate: null, basePrice: 100, basePt: 108, baseCagr: 0.06, basePs: 7.5 },
    { symbol: 'SPCX', name: 'SpaceX New IPO', ipoDate: new Date('2026-06-12'), basePrice: 85, basePt: 130, baseCagr: 0.35, basePs: 22.0 },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', ipoDate: null, basePrice: 125, basePt: 155, baseCagr: 0.38, basePs: 24.5 },
    { symbol: 'PLTR', name: 'Palantir Technologies', ipoDate: null, basePrice: 28, basePt: 35, baseCagr: 0.26, basePs: 18.2 }
];

async function seed() {
    console.log('🌱 Rozpoczynam generowanie bogatej historii dla spółek testowych...');

    // 1. Zapis/Upsert spółek w tabeli Company
    for (const comp of COMPANIES) {
        await prisma.company.upsert({
            where: { symbol: comp.symbol },
            update: {
                name: comp.name,
                isActive: true,
                ipoDate: comp.ipoDate
            },
            create: {
                symbol: comp.symbol,
                name: comp.name,
                isActive: true,
                ipoDate: comp.ipoDate
            }
        });
    }

    // 2. Generowanie 45 dni historii danych dziennych dla każdej spółki
    const numDays = 45;
    const now = new Date();
    
    for (const comp of COMPANIES) {
        console.log(`📊 Generowanie historii dla ${comp.symbol}...`);
        
        let currentPrice = comp.basePrice;
        let currentPt = comp.basePt;
        let currentCagr = comp.baseCagr;
        let currentPs = comp.basePs;

        for (let i = numDays; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            // Pomiń weekendy
            if (date.getDay() === 0 || date.getDay() === 6) continue;

            // Fluktuacje losowe (Random Walk)
            const priceChangePercent = (Math.random() - 0.48) * 0.035;
            currentPrice = Math.max(10, currentPrice * (1 + priceChangePercent));
            
            // Czasem lekka korekta Price Target
            if (Math.random() < 0.2) {
                currentPt = currentPt * (1 + (Math.random() - 0.48) * 0.02);
            }

            // Fluktuacja CAGR i P/S
            currentCagr = Math.max(0.01, currentCagr * (1 + (Math.random() - 0.5) * 0.015));
            currentPs = (currentPrice / comp.basePrice) * comp.basePs;

            const upside = (currentPt - currentPrice) / currentPrice;
            const psgRatio = currentCagr > 0 ? (currentPs / (currentCagr * 100)) : 1;

            const dateStr = date.toISOString().split('T')[0];
            const dataDate = new Date(`${dateStr}T12:00:00.000Z`);

            await prisma.stockData.upsert({
                where: {
                    symbol_date: {
                        symbol: comp.symbol,
                        date: dataDate
                    }
                },
                update: {
                    price: parseFloat(currentPrice.toFixed(2)),
                    marketCap: currentPrice * 100000000,
                    revenueCurrent: 1000000000,
                    revenueEstT0: 1200000000,
                    revenueEstT2: 1500000000,
                    targetConsensus: parseFloat(currentPt.toFixed(2)),
                    cagr2YForward: currentCagr,
                    psRatioForward: parseFloat(currentPs.toFixed(2)),
                    psgRatio: parseFloat(psgRatio.toFixed(2)),
                    upside: upside
                },
                create: {
                    symbol: comp.symbol,
                    date: dataDate,
                    price: parseFloat(currentPrice.toFixed(2)),
                    marketCap: currentPrice * 100000000,
                    revenueCurrent: 1000000000,
                    revenueEstT0: 1200000000,
                    revenueEstT2: 1500000000,
                    targetConsensus: parseFloat(currentPt.toFixed(2)),
                    cagr2YForward: currentCagr,
                    psRatioForward: parseFloat(currentPs.toFixed(2)),
                    psgRatio: parseFloat(psgRatio.toFixed(2)),
                    upside: upside
                }
            });
        }
    }

    // 3. Aktualizacja plików cache
    console.log('💾 Odświeżanie companiesCache.json i latestStocksCache.json...');
    const allCompanies = await prisma.company.findMany({ where: { isActive: true } });
    
    // Najnowsze notowania per spółka
    const latestStocks: any[] = [];
    for (const comp of allCompanies) {
        const latest = await prisma.stockData.findFirst({
            where: { symbol: comp.symbol },
            orderBy: { date: 'desc' }
        });
        if (latest) {
            latestStocks.push({
                ...latest,
                ipoDate: comp.ipoDate ? comp.ipoDate.toISOString() : null
            });
        }
    }

    const cacheLocations = [
        path.join(process.cwd(), 'companiesCache.json'),
        path.join(process.cwd(), 'src', 'companiesCache.json'),
        path.join(process.cwd(), 'dist', 'companiesCache.json')
    ];

    const latestCacheLocations = [
        path.join(process.cwd(), 'latestStocksCache.json'),
        path.join(process.cwd(), 'src', 'latestStocksCache.json'),
        path.join(process.cwd(), 'dist', 'latestStocksCache.json')
    ];

    const companiesData = JSON.stringify(allCompanies.map(c => ({
        symbol: c.symbol,
        name: c.name,
        ipoDate: c.ipoDate ? c.ipoDate.toISOString() : null
    })));

    const latestData = JSON.stringify(latestStocks);

    for (const p of cacheLocations) {
        try { fs.writeFileSync(p, companiesData); } catch (e) {}
    }

    for (const p of latestCacheLocations) {
        try { fs.writeFileSync(p, latestData); } catch (e) {}
    }

    console.log('✅ Zakończono pomyślnie generowanie historii danych i zaktualizowano wszystkie pliki cache!');
}

seed()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
