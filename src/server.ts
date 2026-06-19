import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Otwieramy CORS aby Vercel mógł bez problemu odpytywać to API
app.use(cors());
app.use(express.json());

// 1. Endpoint zwracający listę wszystkich aktywnych spółek (do wyszukiwarki)
app.get('/api/companies', async (req, res) => {
    try {
        const companies = await prisma.company.findMany({
            where: { isActive: true },
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

app.listen(PORT, () => {
    console.log(`✅ Serwer API uruchomiony na porcie ${PORT}`);
});
