import { SectionHead } from '../components/SectionHead';
import { OptionsSection } from '../components/OptionsSection';

export default function Options() {
  return (
    <>
      <section className="section section-first section-tight">
        <div className="wrap">
          <SectionHead
            title="Options Terminal"
            sub="Write covered calls to earn upfront USDG yield on your equity tokens, or write cash-secured puts. Fully collateralised and settled on-chain by Chainlink."
          />
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <OptionsSection />
        </div>
      </section>
    </>
  );
}
