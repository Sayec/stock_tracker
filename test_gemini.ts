import { generatePortfolioSummary } from './src/aiService';
generatePortfolioSummary(['AAPL'], [{ symbol: 'AAPL', price: 150, upside: 0.1, cagr2YForward: 0.2 }])
  .then(console.log)
  .catch(console.error);
