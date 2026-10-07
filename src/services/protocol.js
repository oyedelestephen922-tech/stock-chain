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
  { id: 'tsla', symbol: 'TSLA', name: 'Tesla Stonk Well', shareToken: 'wTSLA', strategy: 'Automated concentrated liquidity for TSLA backed by single-sided USDG.', risk: 'High', assets: ['TSLA', 'USDG'], tvl: 1450000, apy: 14.2, perf30d: 4.8 },
  { id: 'nvda', symbol: 'NVDA', name: 'NVIDIA Stonk Well', shareToken: 'wNVDA', strategy: 'Automated concentrated liquidity for NVDA backed by single-sided USDG.', risk: 'High', assets: ['NVDA', 'USDG'], tvl: 2890000, apy: 16.8, perf30d: 6.2 },
  { id: 'aapl', symbol: 'AAPL', name: 'Apple Stonk Well', shareToken: 'wAAPL', strategy: 'Automated concentrated liquidity for AAPL backed by single-sided USDG.', risk: 'Moderate', assets: ['AAPL', 'USDG'], tvl: 1980000, apy: 8.5, perf30d: 2.1 },
  { id: 'pltr', symbol: 'PLTR', name: 'Palantir Stonk Well', shareToken: 'wPLTR', strategy: 'Automated concentrated liquidity for PLTR backed by single-sided USDG.', risk: 'High', assets: ['PLTR', 'USDG'], tvl: 1120000, apy: 18.4, perf30d: 5.7 },
  { id: 'meta', symbol: 'META', name: 'Meta Stonk Well', shareToken: 'wMETA', strategy: 'Automated concentrated liquidity for META with isolated Borrow Desk eligibility.', risk: 'Moderate', assets: ['META', 'USDG'], tvl: 1650000, apy: 11.2, perf30d: 3.4 },
  { id: 'googl', symbol: 'GOOGL', name: 'Alphabet Stonk Well', shareToken: 'wGOOGL', strategy: 'Automated concentrated liquidity for GOOGL backed by single-sided USDG.', risk: 'Moderate', assets: ['GOOGL', 'USDG'], tvl: 1420000, apy: 9.1, perf30d: 2.5 },
  { id: 'spy', symbol: 'SPY', name: 'SPDR S&P 500 Stonk Well', shareToken: 'wSPY', strategy: 'Broad market index exposure backed by single-sided USDG liquidity.', risk: 'Lower', assets: ['SPY', 'USDG'], tvl: 3850000, apy: 6.8, perf30d: 1.4 },
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
