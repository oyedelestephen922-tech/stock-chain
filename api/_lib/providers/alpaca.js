/**
 * Alpaca Market Data API v2 (https://docs.alpaca.markets).
 * Keys are read from server-side env vars only (never VITE_), so they never reach the browser:
 *   ALPACA_API_KEY_ID, ALPACA_API_SECRET_KEY
 * Optional:
 *   ALPACA_FEED          iex (free plan, real-time IEX trades) | sip (paid, all US exchanges)
 *   ALPACA_TRADING_URL   https://paper-api.alpaca.markets (paper keys) | https://api.alpaca.markets (live keys)
 */
const DATA = 'https://data.alpaca.markets';
const env = () => ({
  key: process.env.ALPACA_API_KEY_ID,
  secret: process.env.ALPACA_API_SECRET_KEY,
  feed: process.env.ALPACA_FEED || 'iex',
  trading: (process.env.ALPACA_TRADING_URL || 'https://paper-api.alpaca.markets').replace(/\/$/, ''),
});

export const alpacaConfigured = () => Boolean(env().key && env().secret);

async function get(base, path, params = {}) {
  const { key, secret } = env();
  const url = new URL(path, base);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret, Accept: 'application/json' } });
  if (res.status === 401) throw new Error('Alpaca rejected the API keys. Check ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY in .env.');
  if (res.status === 403) throw new Error(`Alpaca refused the request (403): ${(await res.text()).slice(0, 160) || 'check your keys and ALPACA_FEED (free plan = iex)'}`);
  if (res.status === 429) throw new Error('Alpaca rate limit reached. Prices will resume shortly.');
  if (!res.ok) throw new Error(`Alpaca responded ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

// Bars: fetch a window back from now and keep the newest `last` bars.
const RANGES = {
  '1H': { timeframe: '1Min', days: 4, last: 60 },
  '1D': { timeframe: '5Min', days: 5, last: 96 },
  '1W': { timeframe: '30Min', days: 10, last: 80 },
  '1M': { timeframe: '1Hour', days: 35, last: 200 },
};

async function bars(symbol, timeframe, days, last) {
  const start = new Date(Date.now() - days * 86400e3).toISOString();
  const json = await get(DATA, `/v2/stocks/${encodeURIComponent(symbol)}/bars`, {
    timeframe, start, limit: 10000, feed: env().feed, adjustment: 'raw',
  });
  return (json.bars || []).slice(-last).map((b) => ({ t: new Date(b.t).getTime(), o: b.o, h: b.h, l: b.l, c: b.c }));
}

// Market session in US Eastern time; the Alpaca clock confirms open/closed (handles holidays).
let clockCache = { at: 0, value: null };
async function clock() {
  if (Date.now() - clockCache.at < 60_000) return clockCache.value;
  try { clockCache = { at: Date.now(), value: await get(env().trading, '/v2/clock') }; }
  catch { clockCache = { at: Date.now(), value: null }; }
  return clockCache.value;
}

function session(c) {
  if (c?.is_open) return 'Open';
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay(), mins = et.getHours() * 60 + et.getMinutes();
  if (day === 0 || day === 6) return 'Closed';
  const nextOpenEt = c?.next_open ? new Date(new Date(c.next_open).toLocaleString('en-US', { timeZone: 'America/New_York' })) : null;
  const tradingToday = nextOpenEt ? nextOpenEt.toDateString() === et.toDateString() || mins >= 570 : true;
  if (tradingToday && mins >= 240 && mins < 570) return 'Pre-market';
  if (mins >= 960 && mins < 1200 && (!c || !nextOpenEt || nextOpenEt.toDateString() !== et.toDateString())) return 'After hours';
  return 'Closed';
}

const sparkCache = new Map();
async function spark(symbol) {
  const hit = sparkCache.get(symbol);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const value = (await bars(symbol, '15Min', 4, 32)).map((b) => b.c);
  sparkCache.set(symbol, { at: Date.now(), value });
  return value;
}

export const alpaca = {
  get name() { return `Alpaca (${env().feed.toUpperCase()} feed)`; },
  async quotes(symbols) {
    const list = symbols.map(([s]) => s).join(',');
    const [json, c] = await Promise.all([get(DATA, '/v2/stocks/snapshots', { symbols: list, feed: env().feed }), clock()]);
    const snaps = json.snapshots || json;
    const status = session(c);
    const sparks = await Promise.allSettled(symbols.map(([s]) => spark(s)));
    return symbols.map(([symbol, name], i) => {
      const s = snaps[symbol];
      if (!s) return null;
      const price = s.latestTrade?.p ?? s.minuteBar?.c ?? s.dailyBar?.c;
      const prev = s.prevDailyBar?.c;
      return {
        symbol, name, price,
        change24h: price != null && prev ? ((price - prev) / prev) * 100 : null,
        status,
        spark: sparks[i].status === 'fulfilled' ? sparks[i].value : [],
        asOf: s.latestTrade?.t ? new Date(s.latestTrade.t).getTime() : null,
      };
    }).filter(Boolean);
  },
  async history(symbol, rangeKey) {
    const cfg = RANGES[rangeKey] || RANGES['1D'];
    return bars(symbol, cfg.timeframe, cfg.days, cfg.last);
  },
};
