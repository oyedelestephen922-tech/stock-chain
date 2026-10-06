import { Hero } from '../components/Hero';
import { HowItWorks } from '../components/HowItWorks';
import { MarketGrid } from '../components/MarketGrid';
import { MarketTicker } from '../components/MarketTicker';
import { SectionHead } from '../components/SectionHead';
import { SecuritySection } from '../components/SecuritySection';
import { StatsSection } from '../components/StatsSection';
import { Strategies } from '../components/Strategies';
import { Transparency } from '../components/Transparency';
import { VaultSection } from '../components/VaultSection';

const PRODUCTS = [
  { n: '01', name: 'Stock Trade', body: 'Buy and sell supported tokenized stocks with a full quote, price impact and fee shown before you sign.', to: '#/trade', cta: 'Open the terminal' },
  { n: '02', name: 'Stock Vaults', body: 'Deposit into strategy vaults that state their holdings, rebalancing rules and risk up front.', to: '#/vaults', cta: 'Browse vaults' },
  { n: '03', name: 'Strategies', body: 'Choose an exposure such as growth, income, blue chip or index, and hold it as one position.', to: '#/vaults', cta: 'Compare strategies' },
];

export default function Home({ reduced }) {
  return (
    <>
      <Hero reduced={reduced} />
      <MarketTicker />
      <section className="section" aria-labelledby="markets-title">
        <div className="wrap">
          <SectionHead id="markets-title" title="Markets without borders." sub="Explore tokenized market opportunities through transparent on-chain infrastructure.">
            <a href="#/markets" className="btn btn-quiet">All markets</a>
          </SectionHead>
          <MarketGrid limit={8} />
        </div>
      </section>
      <StatsSection />
      <section className="section" aria-labelledby="products-title">
        <div className="wrap">
          <SectionHead id="products-title" title="One platform, three ways in." />
          <div className="products">
            {PRODUCTS.map((p) => (
              <a key={p.n} href={p.to} className="product">
                <span className="product-n">{p.n}</span>
                <h3>{p.name}</h3>
                <p>{p.body}</p>
                <span className="product-cta">{p.cta}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
      <Strategies />
      <VaultSection />
      <HowItWorks />
      <Transparency />
      <SecuritySection />
    </>
  );
}
