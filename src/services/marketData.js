import { API } from '../config/site';
import { seeded } from '../utils/random';

/**
 * Market data service.
 *
 * Two providers share one interface so components never care where data comes from:
 *   - ApiProvider: used when VITE_MARKET_API_URL is set.
 *   - DemoProvider: deterministic placeholder data, always flagged `source: 'demo'`.
 *
 * Expected API shape:
 *   GET /markets -> { markets: [{ symbol, name, price, change24h, status, spark?: number[] }] }
 *   GET /markets/:symbol/history?range=1D -> { candles: [{ t, o, h, l, c }] }
 */

// Asset catalogue (names only). Demo prices below are arbitrary and NOT real quotes.
const DEMO_ASSETS = [
  ['TSLA', 'Tesla', 250, 'Automotive / Clean Tech'],
  ['NVDA', 'NVIDIA', 140, 'Semiconductors / AI'],
  ['AAPL', 'Apple', 210, 'Consumer Technology'],
  ['PLTR', 'Palantir', 45, 'Enterprise AI'],
  ['META', 'Meta Platforms', 560, 'Internet / AI'],
  ['GOOGL', 'Alphabet', 170, 'Internet / Cloud'],
  ['SPY', 'S&P 500 ETF', 560, 'Index Fund'],
];

function demoSeries(symbol, base, points, vol) {
  const rnd = seeded(symbol + points);
  const out = [];
  let p = base;
  for (let i = 0; i < points; i++) {
    p = Math.max(1, p * (1 + (rnd() - 0.48) * vol));
    out.push(p);
  }
  return out;
}

const DemoProvider = {
  source: 'demo',
  async getMarkets() {
    const markets = DEMO_ASSETS.map(([symbol, name, base, sector]) => {
      const spark = demoSeries(symbol, base, 32, 0.012);
      const price = spark[spark.length - 1];
      return {
        symbol, name, sector, price,
        change24h: ((price - spark[0]) / spark[0]) * 100,
        status: '24/5',
        spark,
      };
    });
    return { source: 'demo', markets, updatedAt: null };
  },
  async getHistory(symbol, range = '1D') {
    const asset = DEMO_ASSETS.find((a) => a[0] === symbol);
    if (!asset) return { source: 'demo', candles: [] };
    const n = { '1H': 60, '1D': 96, '1W': 84, '1M': 90 }[range] || 96;
    const step = { '1H': 60e3, '1D': 15 * 60e3, '1W': 2 * 3600e3, '1M': 8 * 3600e3 }[range] || 15 * 60e3;
    const rnd = seeded(symbol + range);
    const raw = demoSeries(symbol, asset[2], n, range === '1H' ? 0.003 : 0.008);
    const spark = demoSeries(symbol, asset[2], 32, 0.012);
    const k = spark[spark.length - 1] / raw[raw.length - 1]; // end the chart at the card price
    const closes = raw.map((v) => v * k);
    const now = Date.now();
    const candles = closes.map((c, i) => {
      const o = i ? closes[i - 1] : c * (1 - 0.002);
      const wig = Math.abs(c - o) + c * 0.003 * rnd();
      return { t: now - (n - i) * step, o, c, h: Math.max(o, c) + wig * rnd(), l: Math.min(o, c) - wig * rnd() };
    });
    return { source: 'demo', candles };
  },
};

const ApiProvider = {
  source: 'api',
  async getMarkets() {
    const res = await fetch(`${API.market}/markets`);
    if (!res.ok) throw new Error(`Market API responded ${res.status}`);
    const json = await res.json();
    return { source: 'api', provider: json.source || 'Market API', markets: json.markets || [], updatedAt: json.updatedAt || new Date().toISOString() };
  },
  async getHistory(symbol, range = '1D') {
    const res = await fetch(`${API.market}/markets/${encodeURIComponent(symbol)}/history?range=${range}`);
    if (!res.ok) throw new Error(`Market API responded ${res.status}`);
    const json = await res.json();
    return { source: 'api', candles: json.candles || [] };
  },
};

export const marketProvider = API.market ? ApiProvider : DemoProvider;
export const isDemoMarketData = marketProvider.source === 'demo';
