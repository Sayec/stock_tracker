import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { generateCompanySummary } from './aiService';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Otwieramy CORS aby Vercel mógł bez problemu odpytywać to API
app.use(cors());
app.use(express.json());

// 1. Endpoint zwracający listę wszystkich aktywnych spółek (do wyszukiwarki)
app.get('/api/companies', async (req, res) => {
    try {
        // Pobieramy tylko unikalne symbole z StockData (te, które na 100% mają dane i nie są ETF-ami bez wskaźników)
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
        const upsideLimit = parseFloat(req.query.upside as string) || 0.35;
        const cagrLimit = parseFloat(req.query.cagr as string) || 0.20;
        const marketCapLimit = parseFloat(req.query.marketCap as string) || 10000000000;

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

app.listen(PORT, () => {
    console.log(`✅ Serwer API uruchomiony na porcie ${PORT}`);
});
