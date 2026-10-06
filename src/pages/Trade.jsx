import { TradingTerminal } from '../components/TradingTerminal';

export default function Trade({ symbol }) {
  return (
    <section className="section section-first section-terminal">
      <div className="wrap wrap-wide">
        <TradingTerminal key={symbol || 'default'} symbol={symbol} />
      </div>
    </section>
  );
}
