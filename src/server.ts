import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Otwieramy CORS aby Vercel mógł bez problemu odpytywać to API
app.use(cors());
app.use(express.json());

app.get('/api/stocks', async (req, res) => {
    try {
        const data = await prisma.stockData.findMany({
            orderBy: {
                date: 'asc'
            }
        });

        // Grupujemy dane dla frontendu, by wyrysować linie na wykresach
        const groupedBySymbol = data.reduce((acc: any, curr) => {
            if (!acc[curr.symbol]) {
                acc[curr.symbol] = [];
            }
            acc[curr.symbol].push({
                date: curr.date.toISOString().split('T')[0],
                price: curr.price,
                cagr2YForward: parseFloat((curr.cagr2YForward * 100).toFixed(2)),
                psgRatio: parseFloat(curr.psgRatio.toFixed(2)),
                upside: parseFloat((curr.upside * 100).toFixed(2)),
            });
            return acc;
        }, {});

        res.json(groupedBySymbol);
    } catch (error) {
        console.error('Błąd podczas pobierania danych z bazy:', error);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Serwer API uruchomiony na porcie ${PORT}`);
});
