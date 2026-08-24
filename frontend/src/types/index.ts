export interface Company {
    symbol: string;
    name: string;
}

export interface StockData {
    date: string;
    price: number;
    targetConsensus?: number;
    cagr2YForward: number;
    psRatioForward?: number;
    psgRatio: number;
    psgPercentile?: number | null;
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

export interface MetricOverlaySettings {
    showMean: boolean;
    showMedian: boolean;
    showChannel: boolean;
    channelLowerPercentile: number;
    channelUpperPercentile: number;
}
