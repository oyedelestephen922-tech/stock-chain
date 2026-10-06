import { useState } from 'react';
import { SectionHead } from './SectionHead';

const STRATEGIES = [
  { id: 'growth', name: 'Growth', line: 'Designed around growth-oriented market exposure.', detail: 'Concentrates on companies reinvesting heavily for expansion. Expect larger swings in both directions.', mix: [['NVDA', 30], ['AMD', 25], ['TSLA', 25], ['META', 20]], shape: 'M0 40 L20 34 L40 36 L60 22 L80 26 L100 8' },
  { id: 'income', name: 'Income', line: 'Designed around generating potential yield from supported strategies.', detail: 'Pairs steady holdings with yield sources where available. Yield is variable and can fall to zero.', mix: [['AAPL', 35], ['MSFT', 35], ['SPY', 30]], shape: 'M0 30 L20 28 L40 27 L60 25 L80 24 L100 21' },
  { id: 'bluechip', name: 'Blue chip', line: 'Focused on established companies.', detail: 'Equal weight across mature market leaders with long operating histories.', mix: [['AAPL', 25], ['MSFT', 25], ['AMZN', 25], ['GOOGL', 25]], shape: 'M0 34 L20 30 L40 31 L60 24 L80 22 L100 16' },
  { id: 'index', name: 'Index', line: 'Designed to track diversified market exposure.', detail: 'Follows broad indices through tokenized index funds, keeping single-company risk low.', mix: [['SPY', 60], ['QQQ', 40]], shape: 'M0 32 L20 29 L40 28 L60 26 L80 22 L100 19' },
];

export function Strategies() {
  const [active, setActive] = useState('growth');
  const s = STRATEGIES.find((x) => x.id === active);
  return (
    <section className="section section-strategies" aria-labelledby="strat-title">
      <div className="wrap">
        <SectionHead id="strat-title" title="Pick an exposure, not a hundred tickers." sub="Strategies bundle tokenized assets around one idea. Choose the idea; the strategy handles the mix." />
        <div className="strat">
          <div className="strat-tabs" role="tablist" aria-label="Strategies">
            {STRATEGIES.map((x) => (
              <button key={x.id} role="tab" id={`tab-${x.id}`} aria-selected={active === x.id} aria-controls="strat-panel" className={active === x.id ? 'is-on' : ''} onClick={() => setActive(x.id)}>
                <span className="strat-name">{x.name}</span>
                <span className="strat-line">{x.line}</span>
              </button>
            ))}
          </div>
          <div className="strat-panel" role="tabpanel" id="strat-panel" aria-labelledby={`tab-${s.id}`} key={s.id}>
            <svg className="strat-shape" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">
              <path d={s.shape} fill="none" stroke="url(#stratGold)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
              <defs><linearGradient id="stratGold" x1="0" x2="1"><stop offset="0" stopColor="var(--gold-bronze)" /><stop offset="1" stopColor="var(--gold-bright)" /></linearGradient></defs>
            </svg>
            <h3>{s.name}</h3>
            <p>{s.detail}</p>
            <div className="strat-mix" aria-label="Illustrative allocation">
              {s.mix.map(([sym, pct]) => (
                <div key={sym} className="mix-row">
                  <span>{sym}</span>
                  <span className="mix-bar"><i style={{ width: `${pct}%` }} /></span>
                  <span className="tabular">{pct}%</span>
                </div>
              ))}
            </div>
            <p className="note">Illustrative allocation. Live weights will come from the strategy contract.</p>
            <a href="#/vaults" className="btn btn-line">See matching vaults</a>
          </div>
        </div>
      </div>
    </section>
  );
}
