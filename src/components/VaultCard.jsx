import { useState } from 'react';
import { CONTRACTS } from '../config/contracts';
import { useWallet } from '../hooks/useWallet';
import { fmtCompactUsd, fmtPct } from '../utils/format';

const RISK_LEVEL = { Lower: 1, Moderate: 2, High: 3 };

export function VaultCard({ vault, demo }) {
  const wallet = useWallet();
  const [msg, setMsg] = useState(null);
  const level = RISK_LEVEL[vault.risk] || 2;

  const deposit = () => {
    if (!wallet.isConnected) return wallet.connect();
    if (!CONTRACTS.vaultFactory) return setMsg('Vault contracts are not deployed yet, so deposits are disabled.');
    setMsg('Vault deposit integration is pending its verified ABI.');
  };

  return (
    <article className="vault-card">
      <header>
        <h3>{vault.name}</h3>
        <span className="risk" aria-label={`Risk: ${vault.risk}`}>
          {[1, 2, 3].map((i) => <i key={i} className={i <= level ? 'on' : ''} />)}
          <em>{vault.risk} risk</em>
        </span>
      </header>
      <p className="vault-strategy">{vault.strategy}</p>
      <dl className="vault-metrics">
        <div><dt>TVL</dt><dd className="tabular">{fmtCompactUsd(vault.tvl)}</dd></div>
        <div><dt>APY</dt><dd className="tabular">{vault.apy != null ? `${vault.apy.toFixed(1)}%` : '--'}</dd></div>
        <div><dt>30d</dt><dd className={`tabular ${vault.perf30d >= 0 ? 'txt-up' : 'txt-down'}`}>{fmtPct(vault.perf30d, 1)}</dd></div>
      </dl>
      <p className="vault-assets">{vault.assets.join('  ')}</p>
      <button className="btn btn-line btn-block" onClick={deposit}>{wallet.isConnected ? 'Deposit' : 'Connect to deposit'}</button>
      {msg && <p className="note" role="status">{msg}</p>}
      {demo && <span className="vault-demo">Demo values</span>}
    </article>
  );
}
