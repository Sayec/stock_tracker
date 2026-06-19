// Wzór na CAGR (T0 -> T2): sqrt(revenue_est_t2 / revenue_est_t0) - 1
export function calculateRevenue2YGrowth(revenueEstT0: number, revenueEstT2: number): number {
  if (revenueEstT0 <= 0) return 0;
  return Math.sqrt(revenueEstT2 / revenueEstT0) - 1;
}

// Wzór na PS Ratio Forward: Market Cap / revenue_est_t2
export function calculatePSRatioForward(marketCap: number, revenueEstT2: number): number {
  if (revenueEstT2 <= 0) return 0;
  return marketCap / revenueEstT2;
}

// Wzór na PSG: (PS Ratio 2Y Forward) / (Revenue Estimates 2Y Growth * 100)
export function calculatePSG(psRatioForward: number, revenue2YGrowth: number): number {
  if (revenue2YGrowth <= 0) return 0; // Avoid division by zero or negative growth scenarios
  return psRatioForward / (revenue2YGrowth * 100);
}

// Wzór na Upside: (target_consensus - price) / price
export function calculateUpside(targetConsensus: number, price: number): number {
  if (price <= 0) return 0;
  return (targetConsensus - price) / price;
}
