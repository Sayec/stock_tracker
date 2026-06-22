import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI(apiKey ? { apiKey } : {});

export async function generateCompanySummary(companyName: string, metrics: any[]): Promise<string> {
    if (!apiKey) {
        throw new Error('Brak klucza API Gemini. Upewnij się, że masz GEMINI_API_KEY w pliku .env');
    }

    // Format metrics into a readable string
    let metricsText = '';
    if (metrics && metrics.length > 0) {
        const latest = metrics[metrics.length - 1];
        metricsText = `Najnowsze dane z ${latest.date}:
Cena akcji: $${latest.price}
Kapitalizacja: $${latest.marketCap}
Przewidywany wzrost przychodów (2Y CAGR): ${(latest.cagr2YForward * 100).toFixed(2)}%
Wskaźnik PSG (Price-to-Sales-to-Growth): ${latest.psgRatio.toFixed(2)}
Potencjał wzrostu wg analityków (Upside): ${(latest.upside * 100).toFixed(2)}%`;
    }

const prompt = `Jesteś profesjonalnym, zwięzłym analitykiem giełdowym na Wall Street. 
Twoim zadaniem jest napisać krótkie, biznesowe podsumowanie dla spółki: ${companyName}.
Oto jej aktualne wskaźniki giełdowe z naszego systemu:
${metricsText}

Zasady, których absolutnie musisz przestrzegać:
1. ODPOWIADAJ WYŁĄCZNIE W JĘZYKU POLSKIM.
2. Zaczynasz od 3-4 zdań opisujących z czego znana jest ta firma, jakie konkretnie tworzy innowacje oraz jak nazywają się jej flagowe produkty/usługi (np. jeśli to SpaceX to wspomnij o rakietach Starship i systemie satelitarnym Starlink, jeśli Microsoft to o Windowsie, Azure, itp.). Skup się na realnym biznesie.
3. Ocena wskaźników finansowych ma być tylko pobocznym dodatkiem. NIE podawaj z powrotem ich dokładnych wartości liczbowych (np. CAGR, Upside, PSG), ponieważ użytkownik i tak widzi je na ekranie. Zamiast tego dodaj jedno, dwa zdania ogólnej rynkowej konkluzji (np. "Firma jest stabilna ale przewartościowana" lub "Szybko rosnący biznes o niskiej wycenie").
4. Na końcu wypunktuj 3 kluczowe produkty/usługi lub gałęzie biznesowe w formie krótkich punktów (bullet points), pogrubiając nazwy własne (np. • **Starship**: ...).
5. Nie używaj sztucznych zwrotów typu "Jako model językowy", "Z przyjemnością podsumuję". Od razu przejdź do rzeczy.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
        });

        return response.text || 'Brak wygenerowanego podsumowania.';
    } catch (error) {
        console.error('Błąd podczas generowania podsumowania przez AI:', error);
        throw error;
    }
}
