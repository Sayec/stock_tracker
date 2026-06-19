import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.FMP_API_KEY;
const BASE_URL_STABLE = 'https://financialmodelingprep.com/stable';

if (!API_KEY) {
  throw new Error('FMP_API_KEY is not defined in .env file');
}

export interface Quote {
  symbol: string;
  price: number;
  marketCap: number;
}

export interface IncomeStatement {
  symbol: string;
  revenue: number;
}

export interface AnalystEstimate {
  symbol: string;
  date: string;
  revenueAvg: number;
}

export interface PriceTarget {
  symbol: string;
  targetConsensus: number;
  targetLow: number;
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const response = await axios.get(`${BASE_URL_STABLE}/quote?symbol=${symbol}&apikey=${API_KEY}`);
  if (response.data && response.data.length > 0) {
    return response.data[0];
  }
  return null;
}

export async function getCurrentRevenue(symbol: string): Promise<number | null> {
  const response = await axios.get(`${BASE_URL_STABLE}/income-statement?symbol=${symbol}&limit=1&period=annual&apikey=${API_KEY}`);
  if (response.data && response.data.length > 0) {
    return response.data[0].revenue;
  }
  return null;
}

export async function getAnalystEstimates(symbol: string): Promise<{ t0: number; t1: number; t2: number } | null> {
  const response = await axios.get(`${BASE_URL_STABLE}/analyst-estimates?symbol=${symbol}&period=annual&apikey=${API_KEY}`);
  const estimates: AnalystEstimate[] = response.data;
  
  if (!estimates || estimates.length === 0) {
      return null;
  }

  const today = new Date();
  const futureEstimates = estimates
    .filter(e => new Date(e.date) > today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  if (futureEstimates.length < 3) {
      const sorted = estimates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (sorted.length >= 3) {
          return {
              t0: sorted[sorted.length - 3].revenueAvg,
              t1: sorted[sorted.length - 2].revenueAvg,
              t2: sorted[sorted.length - 1].revenueAvg
          };
      }
      return null;
  }
  
  return { 
      t0: futureEstimates[0].revenueAvg, 
      t1: futureEstimates[1].revenueAvg,
      t2: futureEstimates[2].revenueAvg 
  };
}

export interface ScreenerCompany {
  symbol: string;
  companyName: string;
  exchangeShortName: string;
  isActivelyTrading: boolean;
}

export async function getCompaniesScreener(): Promise<ScreenerCompany[]> {
  const response = await axios.get(`${BASE_URL_STABLE}/company-screener?exchange=NASDAQ,NYSE,AMEX&limit=100000&apikey=${API_KEY}&isEtf=false&isFund=false&isActivelyTrading=true`);
  return response.data || [];
}

export async function getPriceTarget(symbol: string): Promise<PriceTarget | null> {
  const response = await axios.get(`${BASE_URL_STABLE}/price-target-consensus?symbol=${symbol}&apikey=${API_KEY}`);
  if (response.data && response.data.length > 0) {
    return response.data[0];
  }
  return null;
}
