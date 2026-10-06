import { useMemo, useState } from 'react';
import { useMarkets } from '../hooks/useData';
import { DemoBadge } from './DemoBadge';
import { MarketCard } from './MarketCard';

export function MarketGrid({ limit, showFilters = false }) {
  const { data, loading, error } = useMarkets();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('default');

  const markets = useMemo(() => {
    let list = data?.markets || [];
    if (q) list = list.filter((m) => (m.symbol + m.name).toLowerCase().includes(q.toLowerCase()));
    if (sort === 'gainers') list = [...list].sort((a, b) => b.change24h - a.change24h);
    if (sort === 'losers') list = [...list].sort((a, b) => a.change24h - b.change24h);
    return limit ? list.slice(0, limit) : list;
  }, [data, q, sort, limit]);

  return (
    <div className="market-grid-wrap">
      <div className="market-toolbar">
        {data?.source === 'demo' && <DemoBadge>Demo prices · connect a market API for live quotes</DemoBadge>}
        {data?.source === 'api' && (
          <span className="live-src">
            <span className="live-dot" aria-hidden="true" />
            Exchange prices from {data.provider} · updated {new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
        {showFilters && (
          <div className="market-filters">
            <label className="field-inline">
              <span className="sr-only">Search markets</span>
              <input type="search" placeholder="Search ticker or company" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div className="seg" role="group" aria-label="Sort markets">
              {[['default', 'All'], ['gainers', 'Gainers'], ['losers', 'Losers']].map(([k, l]) => (
                <button key={k} className={sort === k ? 'is-on' : ''} onClick={() => setSort(k)} aria-pressed={sort === k}>{l}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      {loading && !data ? (
        <div className="market-grid">{Array.from({ length: limit || 8 }).map((_, i) => <div key={i} className="market-card skeleton" />)}</div>
      ) : error && !data ? (
        <div className="empty">Markets could not be loaded: {error.message}. Check VITE_MARKET_API_URL and try again.</div>
      ) : markets.length === 0 ? (
        <div className="empty">No markets match “{q}”.</div>
      ) : (
        <div className="market-grid">{markets.map((m) => <MarketCard key={m.symbol} market={m} />)}</div>
      )}
    </div>
  );
}
