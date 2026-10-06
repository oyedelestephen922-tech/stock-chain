/**
 * Server-side market data (Vercel functions + local dev server). Never runs in the browser.
 * Provider: Alpaca when ALPACA_API_KEY_ID + ALPACA_API_SECRET_KEY are set, otherwise Yahoo Finance.
 * Prices are exchange prices for the underlying stocks, not on-chain token prices.
 */
import { alpaca, alpacaConfigured } from './providers/alpaca.js';
import { yahoo } from './providers/yahoo.js';

export const SYMBOLS = [
  ['NVDA', 'NVIDIA'], ['AAPL', 'Apple'], ['TSLA', 'Tesla'], ['MSFT', 'Microsoft'],
  ['AMZN', 'Amazon'], ['GOOGL', 'Alphabet'], ['META', 'Meta Platforms'],
  ['AMD', 'Advanced Micro Devices'], ['SPY', 'S&P 500 ETF'], ['QQQ', 'Nasdaq-100 ETF'],
];

const provider = () => (alpacaConfigured() ? alpaca : yahoo);

const cache = new Map();
function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.promise;
  const promise = fn().catch((e) => { cache.delete(key); throw e; });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

export function getMarkets() {
  const p = provider();
  return cached(`m:${p.name}`, 15_000, async () => {
    const markets = await p.quotes(SYMBOLS);
    if (!markets.length) throw new Error('No market data returned');
    return { source: p.name, markets, updatedAt: new Date().toISOString() };
  });
}

export function getHistory(symbol, rangeKey = '1D') {
  const sym = String(symbol || '').toUpperCase();
  if (!SYMBOLS.some(([s]) => s === sym)) return Promise.reject(Object.assign(new Error('Unknown symbol'), { status: 404 }));
  const p = provider();
  return cached(`h:${p.name}:${sym}:${rangeKey}`, 30_000, async () => ({ source: p.name, candles: await p.history(sym, rangeKey) }));
}

/** Plain Node (req, res) handler shared by Vercel and the Vite dev server. */
export async function handle(pathname, query, res) {
  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', status === 200 ? 's-maxage=15, stale-while-revalidate=30' : 'no-store');
    res.end(JSON.stringify(body));
  };
  try {
    const parts = pathname.replace(/^\/?(api\/)?/, '').split('/').filter(Boolean);
    if (parts[0] !== 'markets') return send(404, { error: 'Not found' });
    if (parts.length === 1) return send(200, await getMarkets());
    if (parts.length === 3 && parts[2] === 'history') return send(200, await getHistory(parts[1], query.get('range') || '1D'));
    return send(404, { error: 'Not found' });
  } catch (e) {
    send(e.status || 502, { error: e.message });
  }
}
