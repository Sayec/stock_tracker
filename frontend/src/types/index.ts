export interface Company {
    symbol: string;
    name: string;
}

export interface StockData {
    date: string;
    price: number;
    cagr2YForward: number;
    psgRatio: number;
    upside: number;
}

export interface TopStockData extends StockData {
    symbol: string;
    ipoDate: string | null;
}

export interface QuoteInfo {
    symbol: string;
    price: number;
    changePercent: number;
    earningsDate: string | null;
}
