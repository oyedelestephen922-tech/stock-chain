// Fallback source: Yahoo Finance public chart endpoint (unofficial, no key).
const RANGES = {
  '1H': { range: '1d', interval: '1m', last: 60 },
  '1D': { range: '1d', interval: '5m' },
  '1W': { range: '5d', interval: '30m' },
  '1M': { range: '1mo', interval: '1h' },
};

async function chart(symbol, range, interval) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=true`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (StockChain)', Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Yahoo responded ${res.status} for ${symbol}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(json?.chart?.error?.description || `No data for ${symbol}`);
  return result;
}

function candles(result) {
  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if ([o, h, l, c].some((v) => v == null || Number.isNaN(v))) continue;
    out.push({ t: ts[i] * 1000, o, h, l, c });
  }
  return out;
}

function status(meta) {
  const p = meta.currentTradingPeriod;
  if (!p) return 'Unknown';
  const now = Date.now() / 1000;
  if (now >= p.regular.start && now < p.regular.end) return 'Open';
  if (p.pre && now >= p.pre.start && now < p.pre.end) return 'Pre-market';
  if (p.post && now >= p.post.start && now < p.post.end) return 'After hours';
  return 'Closed';
}

export const yahoo = {
  name: 'Yahoo Finance',
  async quotes(symbols) {
    const settled = await Promise.allSettled(symbols.map(async ([symbol, name]) => {
      const r = await chart(symbol, '1d', '15m');
      const cs = candles(r);
      const price = r.meta.regularMarketPrice ?? cs.at(-1)?.c;
      const prev = r.meta.chartPreviousClose ?? r.meta.previousClose;
      return {
        symbol, name, price,
        change24h: price != null && prev ? ((price - prev) / prev) * 100 : null,
        status: status(r.meta), spark: cs.map((c) => c.c),
        asOf: r.meta.regularMarketTime ? r.meta.regularMarketTime * 1000 : null,
      };
    }));
    const ok = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
    if (!ok.length) throw new Error(settled.find((s) => s.status === 'rejected')?.reason?.message || 'No market data');
    return ok;
  },
  async history(symbol, rangeKey) {
    const cfg = RANGES[rangeKey] || RANGES['1D'];
    let cs = candles(await chart(symbol, cfg.range, cfg.interval));
    if (cfg.last) cs = cs.slice(-cfg.last);
    return cs;
  },
};
