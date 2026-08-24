import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
// @ts-ignore
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function sendDailyDiscordReport() {
    if (!DISCORD_WEBHOOK_URL) {
        console.log('⚠️ Brak podanego DISCORD_WEBHOOK_URL w pliku .env, pomijam powiadomienie.');
        return;
    }

    try {
        console.log('Przygotowuję raport na Discord...');

        // Ustawiamy dzisiejszą datę (od północy) do filtrowania rekordów
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Szukamy najlepszych spółek według kryteriów: Upside > 35% ORAZ CAGR 2Y > 20% ORAZ Market Cap > 10 mld
        const topStocks = await prisma.stockData.findMany({
            where: {
                date: {
                    gte: today
                },
                upside: {
                    gte: 0.35 // Powyżej 35%
                },
                cagr2YForward: {
                    gte: 0.20 // Powyżej 20%
                },
                marketCap: {
                    gte: 10000000000 // Powyżej 10 miliardów USD
                }
            },
            orderBy: {
                upside: 'desc'
            }
        });

        if (topStocks.length === 0) {
            console.log('Brak spółek spełniających wyśrubowane kryteria (Upside > 35%, CAGR > 20%, Cap > 10B) w dzisiejszym skanowaniu.');
            return;
        }

        // Pobieramy historię PSG Ratio dla spółek z topStocks w celu obliczenia percentyli wyceny
        const symbols = topStocks.map(s => s.symbol);
        const historyRows = await prisma.stockData.findMany({
            where: { symbol: { in: symbols } },
            select: { symbol: true, psgRatio: true }
        });

        const psgHistoryMap = new Map<string, number[]>();
        for (const row of historyRows) {
            if (row.psgRatio !== null && !isNaN(row.psgRatio)) {
                if (!psgHistoryMap.has(row.symbol)) {
                    psgHistoryMap.set(row.symbol, []);
                }
                psgHistoryMap.get(row.symbol)!.push(row.psgRatio);
            }
        }

        // Wzbogacamy spółki o percentyl i sortujemy perełki (najpierw dołki wyceny, potem wg upside)
        const enrichedStocks = topStocks.map(stock => {
            let psgPercentile: number | null = null;
            const history = psgHistoryMap.get(stock.symbol);
            if (history && history.length >= 3 && stock.psgRatio !== null && !isNaN(stock.psgRatio)) {
                const countLessOrEqual = history.filter(v => v <= stock.psgRatio!).length;
                psgPercentile = Math.max(1, Math.min(99, Math.round((countLessOrEqual / history.length) * 100)));
            }
            return {
                ...stock,
                psgPercentile,
                isDeepValue: psgPercentile !== null && psgPercentile <= 20
            };
        });

        // Najpierw okazje wycenowe (isDeepValue), potem najwyższy upside
        enrichedStocks.sort((a, b) => {
            if (a.isDeepValue && !b.isDeepValue) return -1;
            if (!a.isDeepValue && b.isDeepValue) return 1;
            return b.upside - a.upside;
        });

        // Formatowanie pól do Embedu na Discordzie
        const fields = enrichedStocks.slice(0, 20).map(stock => {
            const isDip = stock.isDeepValue;
            const titleIcon = isDip ? '💎🔥' : '📈';
            const dipLabel = isDip ? ` 🟢 **[DOŁEK WYCENY: P${stock.psgPercentile}%]**` : '';

            return {
                name: `${titleIcon} ${stock.symbol}${dipLabel}`,
                value: `**Cena:** $${stock.price.toFixed(2)}\n**Analyst Upside:** ${(stock.upside * 100).toFixed(1)}%\n**2Y CAGR:** ${(stock.cagr2YForward * 100).toFixed(1)}%\n**PSG Ratio:** ${stock.psgRatio.toFixed(2)}${stock.psgPercentile ? ` *(P${stock.psgPercentile})*` : ''}`,
                inline: true
            };
        });

        // Jeśli jest więcej niż 20 wyników, dajemy krótkie info
        if (enrichedStocks.length > 20) {
            fields.push({
                name: `...oraz ${enrichedStocks.length - 20} innych spółek`,
                value: "Zaloguj się do platformy, aby zobaczyć pełną listę.",
                inline: false
            });
        }

        const payload = {
            content: "🚨 **Skanowanie Giełdy Zakończone!** Znaleziono potencjalne perełki inwestycyjne z dzisiejszego dnia.",
            embeds: [
                {
                    title: "🏆 Top Spółki (Upside > 35% | 2Y CAGR > 20% | Cap > $10B)",
                    color: 3066993, // Ładny zielony kolor HEX #2EC4B6 konwertowany do dec
                    timestamp: new Date().toISOString(),
                    fields: fields,
                    footer: {
                        text: "Stock Tracker - Daily Report"
                    }
                }
            ]
        };

        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Błąd wysyłki na Discord: ${response.status} ${response.statusText}`);
        }

        console.log('✅ Wysłano raport na Discord pomyślnie!');

    } catch (error) {
        console.error('Wystąpił błąd podczas wysyłania powiadomienia na Discord:', error);
    } finally {
        await prisma.$disconnect();
    }
}
