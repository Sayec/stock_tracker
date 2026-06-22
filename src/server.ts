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

        // Formatowanie pod wykres
        const formatted = data.map(curr => ({
            date: curr.date.toISOString().split('T')[0],
            price: curr.price,
            cagr2YForward: parseFloat((curr.cagr2YForward * 100).toFixed(2)),
            psgRatio: parseFloat(curr.psgRatio.toFixed(2)),
            upside: parseFloat((curr.upside * 100).toFixed(2)),
        }));

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

app.listen(PORT, () => {
    console.log(`✅ Serwer API uruchomiony na porcie ${PORT}`);
});
