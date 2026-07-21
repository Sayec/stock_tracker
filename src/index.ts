import { PrismaClient } from '@prisma/client';
import { getQuote, getCurrentRevenue, getAnalystEstimates, getPriceTarget, getCompanyProfile } from './apiClient';
import { calculateRevenue2YGrowth, calculatePSRatioForward, calculatePSG, calculateUpside } from './metrics';
import { sendDailyDiscordReport } from './discordNotifier';

const prisma = new PrismaClient();

// Bezpieczny mechanizm Throttling (Rate Limiting)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log('Uruchamianie procesu pobierania wskaźników...');

    // 0. Sprawdzenie, czy wczoraj była sesja giełdowa
    try {
        const spyQuote = await getQuote('SPY');
        if (spyQuote && spyQuote.timestamp) {
            const nowSeconds = Math.floor(Date.now() / 1000);
            // Jeśli ostatnia transakcja na SPY była więcej niż 22 godziny temu (79200 sekund)
            if (nowSeconds - spyQuote.timestamp > 79200) {
                console.log('Giełda w USA była wczoraj zamknięta (weekend lub święto). Ostatnia transakcja > 22h temu.');
                console.log('Przerywam pobieranie, aby nie duplikować danych.');
                return;
            }
        }
    } catch (e) {
        console.log('Nie udało się sprawdzić statusu giełdy. Kontynuuję pobieranie prewencyjnie.');
    }
    
    // 1. Pobieramy wszystkie aktywne spółki z bazy
    const companies = await prisma.company.findMany({
        where: { isActive: true },
        select: { symbol: true, ipoDate: true }
    });

    console.log(`Liczba aktywnych spółek w bazie do przetworzenia: ${companies.length}`);

    // Data potrzebna do weryfikacji czy spółka była dzisiaj pobrana
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let processedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < companies.length; i++) {
        const symbol = companies[i].symbol;
        
        console.log(`\n--- Analiza dla: ${symbol} (${i + 1}/${companies.length}) ---`);
        
        try {
            // Zapisanie ipoDate jeśli jeszcze nie mamy (jednorazowa akcja dla każdej spółki)
            if (!companies[i].ipoDate) {
                const profile = await getCompanyProfile(symbol);
                
                // Mamy ograniczenia w API, więc jeśli uderzyliśmy do endpointu profilu, musimy odczekać
                await sleep(1000);

                if (profile && profile.ipoDate) {
                    await prisma.company.update({
                        where: { symbol },
                        data: { ipoDate: new Date(profile.ipoDate) }
                    });
                    console.log(`[DB] Uzupełniono brakującą datę IPO dla ${symbol}: ${profile.ipoDate}`);
                }
            }

            // 2. Sprawdzamy czy spółka była już dzisiaj zaktualizowana (RESUMABILITY)
            const existingData = await prisma.stockData.findUnique({
                where: {
                    symbol_date: {
                        symbol: symbol,
                        date: today
                    }
                }
            });

            if (existingData) {
                skippedCount++;
                // Pomijamy bez sleepa, bo nie wysyłaliśmy zapytania do zewnętrznego API
                continue;
            }

            // 3. Pobieranie danych z API (4 requesty)
            const quote = await getQuote(symbol);
            if (!quote) {
                console.log(`Brak danych o cenie (quote) dla ${symbol}`);
                await sleep(1000); // Throttling
                continue;
            }

            const revenueCurrent = await getCurrentRevenue(symbol);
            const estimates = await getAnalystEstimates(symbol);
            const priceTarget = await getPriceTarget(symbol);
            
            if (!revenueCurrent || !estimates || !priceTarget) {
                console.log(`Brakujące dane fundamentalne dla ${symbol}. Pomijanie.`);
                await sleep(1000); // Throttling
                continue;
            }
            
            // 4. Obliczenia wskaźników
            const revenue2YGrowth = calculateRevenue2YGrowth(estimates.t0, estimates.t2);
            const psRatioForward = calculatePSRatioForward(quote.marketCap, estimates.t2);
            const psgRatio = calculatePSG(psRatioForward, revenue2YGrowth);
            const upside = calculateUpside(priceTarget.targetConsensus, quote.price);

            // 5. Zapis do bazy
            await prisma.stockData.create({
                data: {
                    symbol: symbol,
                    date: today,
                    price: quote.price,
                    marketCap: quote.marketCap,
                    revenueCurrent: revenueCurrent,
                    revenueEstT0: estimates.t0,
                    revenueEstT2: estimates.t2,
                    targetConsensus: priceTarget.targetConsensus,
                    cagr2YForward: revenue2YGrowth,
                    psRatioForward: psRatioForward,
                    psgRatio: psgRatio,
                    upside: upside
                }
            });
            console.log(`[DB] Zapisano dane dla ${symbol}.`);
            processedCount++;

        } catch (error: any) {
            // Ignorujemy błędy i kontynuujemy pobieranie dla innych spółek
            console.error(`Błąd podczas przetwarzania ${symbol}:`, error.message);
        }

        // 6. TWARDY LIMIT API: Czekamy ~1000ms po każdej spółce (ochrona przed zbanowaniem)
        await sleep(1000);
    }

    console.log(`\n✅ Zakończono przetwarzanie. Nowe wpisy: ${processedCount}, pominięte (już były): ${skippedCount}`);

    // 7. WYSYŁKA RAPORTU NA DISCORD (podsumowanie dnia)
    await sendDailyDiscordReport();

    // 8. Odtworzenie lokalnego cache dla API frontendu
    console.log('Generowanie pliku cache ze spółkami...');
    try {
        const symbolsWithData = await prisma.stockData.groupBy({ by: ['symbol'] });
        const validSymbols = symbolsWithData.map(s => s.symbol);

        const activeCompanies = await prisma.company.findMany({
            where: { isActive: true, symbol: { in: validSymbols } },
            select: { symbol: true, name: true }
        });

        const fs = require('fs');
        const path = require('path');
        const CACHE_FILE_PATH = path.join(__dirname, 'companiesCache.json');
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(activeCompanies));
        console.log('✅ Zapisano plik cache ze spółkami.');

        // Odtworzenie cache dla Skanera
        const latestRecord = await prisma.stockData.findFirst({
            orderBy: { date: 'desc' },
            select: { date: true }
        });

        if (latestRecord) {
            const targetDate = new Date(latestRecord.date);
            targetDate.setHours(0, 0, 0, 0);

            const latestStocks = await prisma.stockData.findMany({
                where: { date: { gte: targetDate } },
                orderBy: { upside: 'desc' }
            });

            const companyMap = new Map(activeCompanies.map(c => [c.symbol, (c as any).ipoDate || null]));
            const merged = latestStocks.map(stock => ({
                ...stock,
                ipoDate: companyMap.get(stock.symbol) || null
            }));

            const LATEST_STOCKS_FILE_PATH = path.join(__dirname, 'latestStocksCache.json');
            fs.writeFileSync(LATEST_STOCKS_FILE_PATH, JSON.stringify(merged));
            console.log('✅ Zapisano plik cache ze skanerem.');
        }

    } catch (e: any) {
        console.error('Błąd przy zapisywaniu cache:', e.message);
    }
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
