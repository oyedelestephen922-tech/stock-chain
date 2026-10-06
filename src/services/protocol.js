import { API } from '../config/site';

/**
 * Protocol data (vaults, platform metrics).
 * Without VITE_PROTOCOL_API_URL, vault cards use labelled demo values and
 * platform metrics stay null so the UI shows "--" instead of invented numbers.
 *
 * Expected API shape:
 *   GET /vaults -> { vaults: [{ id, name, strategy, tvl, apy, perf30d, risk, assets: string[] }] }
 *   GET /stats  -> { markets, volume, tvl, users }
 */

const DEMO_VAULTS = [
  { id: 'growth', name: 'Growth Vault', strategy: 'Weighted toward high-growth technology names, rebalanced when weights drift.', risk: 'High', assets: ['NVDA', 'AMD', 'TSLA', 'META'], tvl: 1240000, apy: 9.4, perf30d: 3.1 },
  { id: 'income', name: 'Income Vault', strategy: 'Targets potential yield from supported lending and liquidity strategies.', risk: 'Moderate', assets: ['AAPL', 'MSFT', 'SPY'], tvl: 860000, apy: 6.2, perf30d: 0.9 },
  { id: 'bluechip', name: 'Blue Chip Vault', strategy: 'Equal-weight exposure to large, established companies.', risk: 'Moderate', assets: ['AAPL', 'MSFT', 'AMZN', 'GOOGL'], tvl: 2100000, apy: 4.8, perf30d: 1.6 },
  { id: 'market', name: 'Market Vault', strategy: 'Tracks broad index exposure through tokenized index funds.', risk: 'Lower', assets: ['SPY', 'QQQ'], tvl: 3400000, apy: 3.9, perf30d: 1.2 },
];

export async function getVaults() {
  if (!API.protocol) return { source: 'demo', vaults: DEMO_VAULTS };
  const res = await fetch(`${API.protocol}/vaults`);
  if (!res.ok) throw new Error(`Protocol API responded ${res.status}`);
  const json = await res.json();
  return { source: 'api', vaults: json.vaults || [] };
}

export async function getPlatformStats() {
  if (!API.protocol) return { source: 'none', markets: null, volume: null, tvl: null, users: null };
  const res = await fetch(`${API.protocol}/stats`);
  if (!res.ok) throw new Error(`Protocol API responded ${res.status}`);
  return { source: 'api', ...(await res.json()) };
}
