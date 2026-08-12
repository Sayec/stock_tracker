import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { PrismaClient } from '@prisma/client';
import { generateCompanySummary, generatePortfolioSummary } from './aiService';
import YahooFinance from 'yahoo-finance2';
import fs from 'fs';
import path from 'path';

const yahooFinance = new YahooFinance();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(cors());
app.use(express.json());

// Middleware do mierzenia czasu odpowiedzi i weryfikacji wydajności
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`⏱️  [API] ${req.method} ${req.originalUrl} - ${duration}ms`);
    });
    next();
});

const CACHE_FILE_PATH = path.resolve(__dirname, '..', 'companiesCache.json');
const LATEST_STOCKS_FILE_PATH = path.resolve(__dirname, '..', 'latestStocksCache.json');

// === IN-MEMORY CACHE (z automatycznym wykrywaniem zmian w pliku) ===
let companiesMemCache: any[] | null = null;
let latestStocksMemCache: any[] | null = null;
let lastCompaniesFileMtime: number = 0;
let lastLatestStocksFileMtime: number = 0;
function checkAndReloadCaches() {
    try {
        if (fs.existsSync(CACHE_FILE_PATH)) {
            const stats = fs.statSync(CACHE_FILE_PATH);
            if (stats.mtimeMs > lastCompaniesFileMtime) {
                companiesMemCache = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'));
                lastCompaniesFileMtime = stats.mtimeMs;
                console.log(`🔄 [BACKGROUND RELOAD] Przeładowano companiesCache.json w tle! Wczytano ${companiesMemCache!.length} firm.`);
            }
        }
    } catch (e) {
        console.error(`❌ Error reloading companiesCache:`, e);
    }

    try {
        if (fs.existsSync(LATEST_STOCKS_FILE_PATH)) {
            const stats = fs.statSync(LATEST_STOCKS_FILE_PATH);
            if (stats.mtimeMs > lastLatestStocksFileMtime) {
                latestStocksMemCache = JSON.parse(fs.readFileSync(LATEST_STOCKS_FILE_PATH, 'utf-8'));
                lastLatestStocksFileMtime = stats.mtimeMs;
                console.log(`🔄 [BACKGROUND RELOAD] Przeładowano latestStocksCache.json w tle! Wczytano ${latestStocksMemCache!.length} spółek.`);
            }
        }
    } catch (e) {
        console.error(`❌ Error reloading latestStocksCache:`, e);
    }
}

// Obserwowanie zmian w plikach cache w tle (Event-driven via inotify)
try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
        fs.watch(CACHE_FILE_PATH, () => {
            checkAndReloadCaches();
        });
    }
    if (fs.existsSync(LATEST_STOCKS_FILE_PATH)) {
        fs.watch(LATEST_STOCKS_FILE_PATH, () => {
            checkAndReloadCaches();
        });
    }
} catch (err) {
    console.error('Error setting up file watchers:', err);
}

// Pierwsze załadowanie przy starcie
checkAndReloadCaches();

app.get('/api/companies', async (req, res) => {
    try {
        if (companiesMemCache) {
            return res.json(companiesMemCache);
        }

        // Szybki fallback z bazy danych (tylko aktywne spółki)
        const companies = await prisma.company.findMany({
            where: { isActive: true },
            select: { symbol: true, name: true },
            orderBy: { symbol: 'asc' }
        });

        // Zapis do pliku i załadowanie do pamięci
        try {
            fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(companies));
        } catch (e) {
            console.error('Nie udało się zapisać pliku cache firm:', e);
        }
        companiesMemCache = companies;

        res.json(companies);
    } catch (error) {
        console.error('Błąd pobierania firm:', error);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// 2. Endpoint zwracający historię wskaźników dla KONKRETNEJ spółki
app.get('/api/stocks', async (req, res) => {
    const symbol = req.query.symbol as string;

    if (!symbol) {
        return res.status(400).json({ error: 'Należy podać parametr symbol' });
    }

    try {
        const data = await prisma.stockData.findMany({
            where: { symbol: symbol },
            orderBy: { date: 'asc' }
        });

        // Formatowanie pod wykres (z uwzględnieniem strefy czasowej)
        const rawFormatted = data.map(curr => {
            // Korekta o strefę czasową, by toISOString() nie ucinało dat na poprzedni dzień (UTC)
            const localDate = new Date(curr.date.getTime() - (curr.date.getTimezoneOffset() * 60000));
            return {
                date: localDate.toISOString().split('T')[0],
                price: curr.price,
                targetConsensus: curr.targetConsensus,
                cagr2YForward: parseFloat((curr.cagr2YForward * 100).toFixed(2)),
                psgRatio: parseFloat(curr.psgRatio.toFixed(2)),
                upside: parseFloat((curr.upside * 100).toFixed(2)),
            };
        });

        // Deduplikacja po dacie (jeśli byłyby 2 wyniki z tego samego dnia, bierzemy najnowszy)
        const formatted = Object.values(
            rawFormatted.reduce((acc, curr) => {
                acc[curr.date] = curr;
                return acc;
            }, {} as Record<string, typeof rawFormatted[0]>)
        );

        res.json(formatted);
    } catch (error) {
        console.error(`Błąd pobierania danych dla ${symbol}:`, error);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// 3. Endpoint pobierający / generujący podsumowanie AI dla spółki
app.get('/api/companies/:symbol/summary', async (req, res) => {
    const symbol = req.params.symbol;

    try {
        const company = await prisma.company.findUnique({
            where: { symbol }
        });

        if (!company) {
            return res.status(404).json({ error: 'Spółka nie istnieje' });
        }

        // Sprawdzamy czy podsumowanie istnieje i ma mniej niż 7 dni
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const now = new Date();
        const isFresh = company.aiSummaryDate &&
            (now.getTime() - company.aiSummaryDate.getTime() < SEVEN_DAYS);

        if (company.aiSummary && isFresh) {
            // Zwracamy z pamięci cache (Baza danych)
            return res.json({ aiSummary: company.aiSummary });
        }

        // Jeśli brakuje lub jest nieaktualne, odpytujemy AI
        const data = await prisma.stockData.findMany({
            where: { symbol: symbol },
            orderBy: { date: 'asc' }
        });

        const newSummary = await generateCompanySummary(company.name, data);

        // Zapisujemy nowy wynik w bazie
        await prisma.company.update({
            where: { symbol },
            data: {
                aiSummary: newSummary,
                aiSummaryDate: new Date(),
            }
        });

        res.json({ aiSummary: newSummary });
    } catch (error) {
        console.error(`Błąd przy AI dla ${symbol}:`, error);
        res.status(500).json({ error: 'Błąd generowania podsumowania AI' });
    }
});

// 4. Endpoint do "Dzisiejszych Perełek" (dynamiczny skaner rynku)
app.get('/api/stocks/top', async (req, res) => {
    try {
        const upsideLimit = req.query.upside !== undefined ? parseFloat(req.query.upside as string) : 0.35;
        const cagrLimit = req.query.cagr !== undefined ? parseFloat(req.query.cagr as string) : 0.20;
        const marketCapLimit = req.query.marketCap !== undefined ? parseFloat(req.query.marketCap as string) : 10000000000;

        if (latestStocksMemCache) {
            const filtered = latestStocksMemCache.filter((s: any) =>
                s.upside >= upsideLimit &&
                s.cagr2YForward >= cagrLimit &&
                s.marketCap >= marketCapLimit
            );
            return res.json(filtered);
        }

        console.log('⚠️ [API] Brak pliku latestStocksCache.json! Wykonuję ciężkie zapytanie do bazy danych PostgreSQL...');
        const latestRecord = await prisma.stockData.findFirst({
            orderBy: { date: 'desc' },
            select: { date: true }
        });

        if (!latestRecord) {
            return res.json([]);
        }

        const targetDate = new Date(latestRecord.date);
        targetDate.setHours(0, 0, 0, 0);

        const topStocks = await prisma.stockData.findMany({
            where: {
                date: { gte: targetDate },
                upside: { gte: upsideLimit },
                cagr2YForward: { gte: cagrLimit },
                marketCap: { gte: marketCapLimit }
            },
            orderBy: { upside: 'desc' }
        });

        const symbols = topStocks.map(s => s.symbol);
        const companies = await prisma.company.findMany({
            where: { symbol: { in: symbols } },
            select: { symbol: true, ipoDate: true }
        });

        const companyMap = new Map(companies.map(c => [c.symbol, c.ipoDate]));
        // Pobieramy WSZYSTKIE spółki z ostatniego dnia (bez filtrów) do cache w RAMie
        const allLatestStocks = await prisma.stockData.findMany({
            where: { date: { gte: targetDate } },
            orderBy: { upside: 'desc' }
        });
        const allMerged = allLatestStocks.map(stock => ({
            ...stock,
            ipoDate: companyMap.get(stock.symbol) || null
        }));

        // Zapisz WSZYSTKIE spółki do RAM-u — filtrowanie odbywa się w pamięci
        latestStocksMemCache = allMerged;
        console.log(`✅ [/api/stocks/top] Załadowano ${allMerged.length} spółek do RAM-u z bazy danych (fallback).`);

        // Zwróć przefiltrowane dane
        const merged = allMerged.filter((s: any) =>
            s.upside >= upsideLimit &&
            s.cagr2YForward >= cagrLimit &&
            s.marketCap >= marketCapLimit
        );

        res.json(merged);
    } catch (error) {
        console.error('Błąd pobierania topowych spółek:', error);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera przy pobieraniu top spółek' });
    }
});

// 5. Endpoint do generowania cotygodniowego raportu dla portfolio
app.post('/api/portfolio/summary', async (req, res) => {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ error: 'Należy przekazać tablicę symboli' });
    }

    try {
        // Pobierz najnowsze metryki dla podanych spółek
        const latestData = await prisma.stockData.findMany({
            where: { symbol: { in: symbols } },
            orderBy: { date: 'desc' },
            distinct: ['symbol'], // Pobieramy tylko najnowszy rekord dla każdego symbolu
        });

        const report = await generatePortfolioSummary(symbols, latestData);
        res.json({ report });
    } catch (error) {
        console.error('Błąd generowania raportu portfolio:', error);
        res.status(500).json({ error: 'Błąd generowania raportu portfolio' });
    }
});

const quotesCacheMap = new Map<string, { data: any; timestamp: number }>();
const QUOTES_CACHE_TTL = 15 * 60 * 1000; // 15 minut

// 6. Endpoint pobierający ceny "na żywo" i daty wyników przez Yahoo Finance (z podgrzewanym cache)
app.post('/api/portfolio/quotes', async (req, res) => {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ error: 'Należy przekazać tablicę symboli' });
    }
    try {
        const now = Date.now();
        const missingSymbols: string[] = [];
        const cachedResults: any[] = [];

        for (const sym of symbols) {
            const cached = quotesCacheMap.get(sym);
            if (cached && (now - cached.timestamp < QUOTES_CACHE_TTL)) {
                cachedResults.push(cached.data);
            } else {
                missingSymbols.push(sym);
            }
        }

        if (missingSymbols.length === 0) {
            return res.json({ quotes: cachedResults });
        }

        // Pobieramy z Yahoo Finance tylko brakujące/przestarzałe notowania z timeoutem 3.5s
        const fetchPromise = yahooFinance.quote(missingSymbols);
        const timeoutPromise = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 3500));
        const fetchedQuotes: any[] = await Promise.race([fetchPromise, timeoutPromise]);

        const getNextEarningsDate = (q: any) => {
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            const dates = [
                q.earningsTimestamp ? new Date(q.earningsTimestamp) : null,
                q.earningsTimestampStart ? new Date(q.earningsTimestampStart) : null,
                q.earningsTimestampEnd ? new Date(q.earningsTimestampEnd) : null
            ].filter((d): d is Date => d !== null);

            if (dates.length === 0) return null;

            // Szukamy najbliższej daty w przyszłości
            const futureDates = dates.filter(d => d >= currentDate).sort((a, b) => a.getTime() - b.getTime());
            if (futureDates.length > 0) return futureDates[0].toISOString();

            // Jeśli wszystkie daty z Yahoo dotyczą przeszłości, to brak znanej daty KOLEJNYCH wyników
            return null;
        };

        const newResults = fetchedQuotes.map(q => {
            const mapped = {
                symbol: q.symbol,
                price: q.regularMarketPrice,
                changePercent: q.regularMarketChangePercent,
                earningsDate: getNextEarningsDate(q)
            };
            quotesCacheMap.set(q.symbol, { data: mapped, timestamp: now });
            return mapped;
        });

        const allResults = [...cachedResults, ...newResults];
        res.json({ quotes: allResults });
    } catch (error) {
        console.error('Błąd pobierania notowań z Yahoo Finance:', error);
        res.status(500).json({ error: 'Błąd pobierania notowań z Yahoo' });
    }
});

app.listen(PORT, async () => {
    // Wymuszenie połączenia z bazą na starcie, aby pierwszy użytkownik nie odczuł opóźnienia
    await prisma.$connect();
    console.log(`✅ Serwer API uruchomiony na porcie ${PORT}`);
});
