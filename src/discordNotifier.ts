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
            // Opcjonalnie: można tu wysłać info, że nic nie znaleziono, ale bot będzie wtedy "spamił". Lepiej milczeć.
            return;
        }

        // Formatowanie pól do Embedu na Discordzie
        const fields = topStocks.slice(0, 20).map(stock => {
            return {
                name: `📈 ${stock.symbol}`,
                value: `**Cena:** $${stock.price.toFixed(2)}\n**Analyst Upside:** ${(stock.upside * 100).toFixed(1)}%\n**2Y CAGR:** ${(stock.cagr2YForward * 100).toFixed(1)}%\n**PSG Ratio:** ${stock.psgRatio.toFixed(2)}`,
                inline: true
            };
        });

        // Jeśli jest więcej niż 20 wyników, dajemy krótkie info
        if (topStocks.length > 20) {
            fields.push({
                name: `...oraz ${topStocks.length - 20} innych spółek`,
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
