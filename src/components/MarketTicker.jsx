import { useMarkets } from '../hooks/useData';
import { fmtPct, fmtUsd } from '../utils/format';
import { DemoBadge } from './DemoBadge';

export function MarketTicker() {
  const { data, loading, error } = useMarkets();
  const items = data?.markets || [];
  const demo = data?.source === 'demo';

  return (
    <div className="ticker" aria-label="Market ticker">
      {demo && <div className="ticker-flag"><DemoBadge>Demo</DemoBadge></div>}
      <div className="ticker-viewport">
        {loading && !items.length ? (
          <div className="ticker-msg">Loading markets…</div>
        ) : error && !items.length ? (
          <div className="ticker-msg">Market feed unavailable.</div>
        ) : (
          <div className="ticker-track" style={{ '--count': items.length }}>
            {[0, 1].map((dup) => (
              <ul key={dup} className="ticker-row" aria-hidden={dup === 1 ? 'true' : undefined}>
                {items.map((m) => (
                  <li key={m.symbol + dup}>
                    <a href={`#/trade/${m.symbol}`} tabIndex={dup ? -1 : 0}>
                      <strong>{m.symbol}</strong>
                      <span className="tabular">{fmtUsd(m.price)}</span>
                      <span className={`tabular ${m.change24h >= 0 ? 'txt-up' : 'txt-down'}`}>{fmtPct(m.change24h)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
