import { fmtPct, fmtUsd } from '../utils/format';
import { Sparkline } from './Sparkline';

export function MarketCard({ market }) {
  const up = market.change24h >= 0;
  return (
    <article className="market-card">
      <header className="market-card-head">
        <div>
          <h3 className="market-sym">{market.symbol}</h3>
          <p className="market-name">{market.name}</p>
        </div>
        <span className="market-status" title="Trading window">{market.status}</span>
      </header>
      <div className="market-card-price">
        <span className="price tabular">{fmtUsd(market.price)}</span>
        <span className={`chg tabular ${up ? 'txt-up' : 'txt-down'}`}>{fmtPct(market.change24h)}</span>
      </div>
      <Sparkline data={market.spark} up={up} width={260} height={48} />
      <a className="btn btn-line btn-block" href={`#/trade/${market.symbol}`}>Trade {market.symbol}</a>
    </article>
  );
}
