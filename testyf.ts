
async function main() {
    try {
        const yf = await import('yahoo-finance2');
        const yahooFinance = yf.default;
        const quote: any = await yahooFinance.quote('AAPL');
        console.log('Quote:', { price: quote.regularMarketPrice, change: quote.regularMarketChangePercent, earnings: quote.earningsTimestamp });
        
        const summary: any = await yahooFinance.quoteSummary('AAPL', { modules: ['calendarEvents'] });
        console.log('CalendarEvents:', JSON.stringify(summary.calendarEvents?.earnings));
    } catch(err) {
        console.error(err);
    }
}
main();
