import { MarketGrid } from '../components/MarketGrid';
import { MarketTicker } from '../components/MarketTicker';
import { SectionHead } from '../components/SectionHead';

export default function Markets() {
  return (
    <>
      <div className="page-top" />
      <section className="section section-first">
        <div className="wrap">
          <SectionHead title="Markets" sub="Every supported tokenized asset, with price, daily change and trading window." />
          <MarketGrid showFilters />
        </div>
      </section>
      <MarketTicker />
    </>
  );
}
