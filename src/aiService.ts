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
2. Podsumowanie ma mieć 4-6 zdań i być bardzo rzetelne, skupione na tym, co spółka robi (jej model biznesowy).
3. Oceniając podane wskaźniki (np. CAGR, Upside, PSG), NIE cytuj z powrotem ich dokładnych wartości liczbowych w tekście, ponieważ użytkownik i tak widzi je obok na wykresie. Zamiast tego skup się na ich interpretacji (np. napisz "spółka rośnie bardzo dynamicznie" zamiast "CAGR wynosi 58.67%").
4. Na końcu wypunktuj 3 kluczowe wnioski (bullet points), pogrubiając najważniejsze słowa (np. • **Potencjał wzrostu**: ...).
5. Nie używaj sztucznych zwrotów typu "Jako model językowy", "Z przyjemnością podsumuję". Od razu przejdź do rzeczy.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || 'Brak wygenerowanego podsumowania.';
    } catch (error) {
        console.error('Błąd podczas generowania podsumowania przez AI:', error);
        throw error;
    }
}
