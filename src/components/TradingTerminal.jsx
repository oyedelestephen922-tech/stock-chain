import { useEffect, useState } from 'react';
import { useHistory, useMarkets } from '../hooks/useData';
import { fmtPct, fmtUsd } from '../utils/format';
import { DemoBadge } from './DemoBadge';
import { PriceChart } from './PriceChart';
import { TradePanel } from './TradePanel';
import { TxHistory } from './TxHistory';

const RANGES = ['1H', '1D', '1W', '1M'];

export function TradingTerminal({ symbol: initial }) {
  const { data, loading, error } = useMarkets();
  const markets = data?.markets || [];
  const [symbol, setSymbolState] = useState(initial || 'NVDA');
  const [range, setRange] = useState('1D');
  const [mode, setMode] = useState('line');
  const history = useHistory(symbol, range);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const fn = (e) => setNarrow(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  const market = markets.find((m) => m.symbol === symbol) || markets[0];
  const demo = data?.source === 'demo';

  const setSymbol = (s) => {
    setSymbolState(s);
    window.history.replaceState(null, '', `#/trade/${s}`);
  };

  if (loading && !data) return <div className="terminal-loading">Loading terminal…</div>;
  if (error && !data) return <div className="empty">Market data unavailable: {error.message}</div>;

  return (
    <div className="terminal">
      <aside className="term-assets" aria-label="Assets">
        <div className="term-assets-head"><span>Asset</span><span>Price</span></div>
        <ul>
          {markets.map((m) => (
            <li key={m.symbol}>
              <button className={m.symbol === market?.symbol ? 'is-on' : ''} onClick={() => setSymbol(m.symbol)} aria-current={m.symbol === market?.symbol}>
                <span className="ta-sym">{m.symbol}<small>{m.name}</small></span>
                <span className="ta-px tabular">{fmtUsd(m.price)}<small className={m.change24h >= 0 ? 'txt-up' : 'txt-down'}>{fmtPct(m.change24h)}</small></span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="term-chart" aria-label="Chart">
        <header className="term-chart-head">
          <div>
            <h2 className="term-sym">{market?.symbol} <span>{market?.name}</span></h2>
            <p className="term-px">
              <span className="tabular">{fmtUsd(market?.price)}</span>
              <span className={`tabular ${market?.change24h >= 0 ? 'txt-up' : 'txt-down'}`}>{fmtPct(market?.change24h)}</span>
              {demo && <DemoBadge />}
            </p>
          </div>
          <div className="term-controls">
            <div className="seg seg-sm" role="group" aria-label="Range">
              {RANGES.map((r) => <button key={r} className={range === r ? 'is-on' : ''} onClick={() => setRange(r)} aria-pressed={range === r}>{r}</button>)}
            </div>
            <div className="seg seg-sm" role="group" aria-label="Chart type">
              <button className={mode === 'line' ? 'is-on' : ''} onClick={() => setMode('line')} aria-pressed={mode === 'line'}>Line</button>
              <button className={mode === 'candles' ? 'is-on' : ''} onClick={() => setMode('candles')} aria-pressed={mode === 'candles'}>Candles</button>
            </div>
          </div>
        </header>
        {history.error ? (
          <div className="chart-empty">Price history unavailable.</div>
        ) : (
          <PriceChart candles={history.data?.candles || []} mode={mode} height={narrow ? 280 : 470} />
        )}
      </section>

      <div className="term-side">
        <TradePanel markets={markets} symbol={market?.symbol} onSymbol={setSymbol} demo={demo} />
        <TxHistory />
      </div>
    </div>
  );
}
