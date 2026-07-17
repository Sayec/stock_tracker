import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { generateCompanySummary, generatePortfolioSummary } from './aiService';
import YahooFinance from 'yahoo-finance2';
import fs from 'fs';
import path from 'path';

const yahooFinance = new YahooFinance();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const CACHE_FILE_PATH = path.join(__dirname, 'companiesCache.json');

app.get('/api/companies', async (req, res) => {
    try {
        // Zawsze czytamy z pliku, jeśli istnieje, aby nie blokować frontendu
        // Plik ten jest generowany raz dziennie przez skrypt index.ts
        if (fs.existsSync(CACHE_FILE_PATH)) {
            const fileData = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
            return res.json(JSON.parse(fileData));
        }

        // Pobieramy z bazy danych TYLKO jako fallback (np. pierwsze uruchomienie)
        const symbolsWithData = await prisma.stockData.groupBy({
            by: ['symbol'],
        });
        const validSymbols = symbolsWithData.map(s => s.symbol);

        const companies = await prisma.company.findMany({
            where: { 
                isActive: true,
                symbol: { in: validSymbols }
            },
            select: { symbol: true, name: true }
        });

        // Zapis do pliku
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(companies));

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

        const merged = topStocks.map(stock => {
            const company = companies.find(c => c.symbol === stock.symbol);
            return {
                ...stock,
                ipoDate: company?.ipoDate || null
            };
        });

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

// 6. Endpoint pobierający ceny "na żywo" i daty wyników przez Yahoo Finance
app.post('/api/portfolio/quotes', async (req, res) => {
    const { symbols } = req.body;
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ error: 'Należy przekazać tablicę symboli' });
    }
    try {
        // Yahoo Finance v3 wspiera zapytania batchowe dla quotes
        const quotes: any[] = await yahooFinance.quote(symbols);
        
        const getNextEarningsDate = (q: any) => {
            const now = new Date();
            now.setHours(0,0,0,0);
            const dates = [
                q.earningsTimestamp ? new Date(q.earningsTimestamp) : null,
                q.earningsTimestampStart ? new Date(q.earningsTimestampStart) : null,
                q.earningsTimestampEnd ? new Date(q.earningsTimestampEnd) : null
            ].filter((d): d is Date => d !== null);

            if (dates.length === 0) return null;

            // Najpierw szukamy najbliższej daty w przyszłości
            const futureDates = dates.filter(d => d >= now).sort((a, b) => a.getTime() - b.getTime());
            if (futureDates.length > 0) return futureDates[0].toISOString();
            
            // Jeśli nie ma żadnej w przyszłości, bierzemy najnowszą z przeszłości (fallback)
            const pastDates = dates.filter(d => d < now).sort((a, b) => b.getTime() - a.getTime());
            return pastDates[0].toISOString();
        };

        // Mapowanie do uproszczonego formatu dla frontendu
        const results = quotes.map(q => ({
            symbol: q.symbol,
            price: q.regularMarketPrice,
            changePercent: q.regularMarketChangePercent,
            earningsDate: getNextEarningsDate(q)
        }));

        res.json({ quotes: results });
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
