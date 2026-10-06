import { useVaults } from '../hooks/useData';
import { DemoBadge } from './DemoBadge';
import { SectionHead } from './SectionHead';
import { VaultCard } from './VaultCard';

export function VaultSection({ heading = true }) {
  const { data, loading, error } = useVaults();
  const demo = data?.source === 'demo';
  return (
    <section className="section" id="vaults" aria-labelledby={heading ? 'vaults-title' : undefined}>
      <div className="wrap">
        {heading && (
          <SectionHead id="vaults-title" title="Put idle positions to work." sub="Deposit supported assets into strategy vaults. Each vault states what it holds, how it rebalances and how much risk it carries.">
            {demo && <DemoBadge>Demo TVL, APY and performance. Not real returns.</DemoBadge>}
          </SectionHead>
        )}
        {loading && !data ? (
          <div className="vault-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="vault-card skeleton" />)}</div>
        ) : error ? (
          <div className="empty">Vaults could not be loaded: {error.message}</div>
        ) : (
          <div className="vault-grid">{data.vaults.map((v) => <VaultCard key={v.id} vault={v} demo={demo} />)}</div>
        )}
        <p className="disclaimer">Vault returns are variable and not guaranteed. Strategies can lose value.</p>
      </div>
    </section>
  );
}
