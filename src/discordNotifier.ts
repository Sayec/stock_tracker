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

        // Szukamy najlepszych spółek według kryteriów: Upside > 30% ORAZ CAGR 2Y > 30%
        const topStocks = await prisma.stockData.findMany({
            where: {
                date: {
                    gte: today
                },
                upside: {
                    gte: 0.30 // Powyżej 30%
                },
                cagr2YForward: {
                    gte: 0.30 // Powyżej 30%
                }
            },
            orderBy: {
                upside: 'desc'
            }
        });

        if (topStocks.length === 0) {
            console.log('Brak spółek spełniających wyśrubowane kryteria (Upside > 30% & CAGR > 30%) w dzisiejszym skanowaniu.');
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
                    title: "🏆 Top Spółki (Upside > 30% & 2Y CAGR > 30%)",
                    color: 3066993, // Ładny zielony kolor HEX #2EC4B6 konwertowany do dec
                    timestamp: new Date().toISOString(),
                    fields: fields,
                    footer: {
                        text: "Stock Tracker Pro - Daily Report"
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
