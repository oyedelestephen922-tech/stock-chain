import { SectionHead } from '../components/SectionHead';
import { Strategies } from '../components/Strategies';
import { VaultSection } from '../components/VaultSection';
import { useVaults } from '../hooks/useData';
import { DemoBadge } from '../components/DemoBadge';

export default function Vaults() {
  const { data } = useVaults();
  return (
    <>
      <section className="section section-first section-tight">
        <div className="wrap">
          <SectionHead title="Vaults" sub="Strategy vaults hold tokenized assets on your behalf through smart contracts. You keep the vault shares in your own wallet.">
            {data?.source === 'demo' && <DemoBadge>Demo TVL, APY and performance. Not real returns.</DemoBadge>}
          </SectionHead>
        </div>
      </section>
      <VaultSection heading={false} />
      <Strategies />
    </>
  );
}
