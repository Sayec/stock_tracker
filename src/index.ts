import { PrismaClient } from '@prisma/client';
import { getQuote, getCurrentRevenue, getAnalystEstimates, getPriceTarget } from './apiClient';
import { calculateRevenue2YGrowth, calculatePSRatioForward, calculatePSG, calculateUpside } from './metrics';

const prisma = new PrismaClient();
const SYMBOLS = ['TSLA', 'AMZN', 'MSFT', 'NVDA', 'GOOGL', 'META'];

async function main() {
    console.log('Rozpoczynam pobieranie danych dla spółek...');
    
    for (const symbol of SYMBOLS) {
        console.log(`\n--- Analiza dla: ${symbol} ---`);
        
        try {
            const quote = await getQuote(symbol);
            if (!quote) {
                console.log(`Brak danych o cenie (quote) dla ${symbol}`);
                continue;
            }

            const revenueCurrent = await getCurrentRevenue(symbol);
            const estimates = await getAnalystEstimates(symbol);
            const priceTarget = await getPriceTarget(symbol);
            
            if (!revenueCurrent) {
                console.log(`Brak danych o obecnych przychodach (revenue_current) dla ${symbol}`);
                continue;
            }
            if (!estimates) {
                console.log(`Brak danych o przyszłych przychodach (estimates) dla ${symbol}`);
                continue;
            }
            if (!priceTarget) {
                console.log(`Brak danych o wycenie analityków (price target) dla ${symbol}`);
                continue;
            }
            
            const revenue2YGrowth = calculateRevenue2YGrowth(estimates.t0, estimates.t2);
            const psRatioForward = calculatePSRatioForward(quote.marketCap, estimates.t2);
            const psgRatio = calculatePSG(psRatioForward, revenue2YGrowth);
            const upside = calculateUpside(priceTarget.targetConsensus, quote.price);
            
            console.log(`Obecna cena: $${quote.price}`);
            console.log(`Market Cap: $${quote.marketCap.toLocaleString()}`);
            console.log(`Obecne przychody (raportowane): $${revenueCurrent.toLocaleString()}`);
            console.log(`Prognoza (T0 - bieżący rok): $${estimates.t0.toLocaleString()}`);
            console.log(`Prognoza (T+2 - za 2 lata): $${estimates.t2.toLocaleString()}`);
            console.log(`Wskaźniki:`);
            console.log(`- 2Y Revenue Growth (CAGR): ${(revenue2YGrowth * 100).toFixed(2)}%`);
            console.log(`- P/S Ratio (2Y Forward): ${psRatioForward.toFixed(2)}`);
            console.log(`- PSG Ratio: ${psgRatio.toFixed(2)}`);
            console.log(`- Analyst Upside: ${(upside * 100).toFixed(2)}% (Target: $${priceTarget.targetConsensus})`);

            // Zapis do bazy danych
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            await prisma.stockData.upsert({
                where: {
                    symbol_date: {
                        symbol: symbol,
                        date: today
                    }
                },
                update: {
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
                },
                create: {
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
            console.log(`[DB] Zapisano dane dla ${symbol} do bazy pomyślnie.`);

        } catch (error: any) {
            console.error(`Błąd podczas przetwarzania ${symbol}:`, error.message);
        }
    }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\n✅ Zakończono przetwarzanie.');
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
