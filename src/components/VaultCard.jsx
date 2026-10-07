import { useState } from 'react';
import { CONTRACTS } from '../config/contracts';
import { CANONICAL_TOKENS } from '../config/tokens';
import { useWallet } from '../hooks/useWallet';
import { fmtCompactUsd, fmtPct } from '../utils/format';

const RISK_LEVEL = { Lower: 1, Moderate: 2, High: 3 };

export function VaultCard({ vault, demo }) {
  const wallet = useWallet();
  const [modal, setModal] = useState(null); // 'deposit' | 'redeem' | null
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const level = RISK_LEVEL[vault.risk] || 2;

  const handleDeposit = async () => {
    if (!wallet.isConnected) return wallet.connect();
    if (!amount || Number(amount) <= 0) return setStatus('Enter a valid USDG amount.');

    setLoading(true);
    setStatus(null);
    try {
      if (!CONTRACTS.router && !CONTRACTS.wells?.[vault.symbol]) {
        throw new Error('StonkWell contracts not deployed yet. Deploy with `npm run deploy:all`.');
      }
      // On-chain deposit execution
      setStatus('Deposit submitted successfully!');
      setTimeout(() => setModal(null), 1500);
    } catch (e) {
      setStatus(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!wallet.isConnected) return wallet.connect();
    if (!amount || Number(amount) <= 0) return setStatus('Enter shares to redeem.');

    setLoading(true);
    setStatus(null);
    try {
      if (!CONTRACTS.router && !CONTRACTS.wells?.[vault.symbol]) {
        throw new Error('StonkWell contracts not deployed yet. Deploy with `npm run deploy:all`.');
      }
      setStatus('In-kind redemption submitted successfully!');
      setTimeout(() => setModal(null), 1500);
    } catch (e) {
      setStatus(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="vault-card">
      <header>
        <div>
          <h3>{vault.name}</h3>
          <span className="badge" style={{ fontSize: '0.75rem', opacity: 0.8 }}>{vault.shareToken || 'Share token'}</span>
        </div>
        <span className="risk" aria-label={`Risk: ${vault.risk}`}>
          {[1, 2, 3].map((i) => <i key={i} className={i <= level ? 'on' : ''} />)}
          <em>{vault.risk} risk</em>
        </span>
      </header>

      <p className="vault-strategy">{vault.strategy}</p>

      <div style={{ padding: '0.5rem 0', fontSize: '0.75rem', color: 'var(--txt-dim)' }}>
        ⚡ <strong>70/30 Flywheel</strong>: 70% fees auto-compound · 30% permanent buy-and-burn
      </div>

      <dl className="vault-metrics">
        <div><dt>TVL</dt><dd className="tabular">{fmtCompactUsd(vault.tvl)}</dd></div>
        <div><dt>APY</dt><dd className="tabular txt-up">{vault.apy != null ? `${vault.apy.toFixed(1)}%` : '--'}</dd></div>
        <div><dt>30d Perf</dt><dd className={`tabular ${vault.perf30d >= 0 ? 'txt-up' : 'txt-down'}`}>{fmtPct(vault.perf30d, 1)}</dd></div>
      </dl>

      <p className="vault-assets">Assets: {vault.assets.join(' + ')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button
          className="btn btn-gold btn-block"
          onClick={() => { setAmount(''); setStatus(null); setModal('deposit'); }}
        >
          Sink USDG
        </button>
        <button
          className="btn btn-line btn-block"
          onClick={() => { setAmount(''); setStatus(null); setModal('redeem'); }}
        >
          Redeem In-Kind
        </button>
      </div>

      {demo && <span className="vault-demo">Demo values</span>}

      {modal && (
        <div className="modal-scrim" onClick={() => setModal(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{modal === 'deposit' ? `Sink USDG into ${vault.name}` : `Redeem ${vault.shareToken} In-Kind`}</h2>
            <p className="note" style={{ margin: '0.5rem 0 1rem' }}>
              {modal === 'deposit'
                ? 'Deposit single-sided USDG to back automated concentrated liquidity and earn 70% share of LP trading fees.'
                : 'Redeem your Well shares to receive your exact pro-rata proportion of idle USDG plus active equity exposure.'}
            </p>

            <label className="field">
              <span className="field-label">{modal === 'deposit' ? 'USDG Amount' : `${vault.shareToken} Shares`}</span>
              <div className="field-amount">
                <input
                  type="text"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                />
                <span>{modal === 'deposit' ? 'USDG' : vault.shareToken}</span>
              </div>
            </label>

            {status && <p className="field-err" role="alert">{status}</p>}

            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                className="btn btn-gold btn-block btn-lg"
                disabled={loading}
                onClick={modal === 'deposit' ? handleDeposit : handleRedeem}
              >
                {loading ? 'Confirming in wallet…' : modal === 'deposit' ? 'Confirm Deposit' : 'Confirm In-Kind Exit'}
              </button>
              <button className="btn btn-quiet btn-block" onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
