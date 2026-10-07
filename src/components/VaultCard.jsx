import { useEffect, useState } from 'react';
import { WELLS } from '../config/contracts';
import { useWallet } from '../hooks/useWallet';
import { fmtCompactUsd, fmtNum, fmtPct, fmtUsd } from '../utils/format';
import { depositUSDG, redeemInKind, getUserWellPosition } from '../services/vaults';

const RISK_LEVEL = { Lower: 1, Moderate: 2, High: 3 };

export function VaultCard({ vault, demo }) {
  const wallet = useWallet();
  const [modal, setModal] = useState(null); // 'deposit' | 'redeem' | null
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [txSuccess, setTxSuccess] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const level = RISK_LEVEL[vault.risk] || 2;

  // Refresh user position when connected
  useEffect(() => {
    if (wallet.isConnected && wallet.provider && wallet.address) {
      getUserWellPosition(wallet.provider, vault.symbol, wallet.address)
        .then(setUserPosition)
        .catch(() => setUserPosition(null));
    } else {
      setUserPosition(null);
    }
  }, [wallet.isConnected, wallet.provider, wallet.address, vault.symbol]);

  const handleDeposit = async () => {
    if (!wallet.isConnected) return wallet.connect();
    if (!amount || Number(amount) <= 0) return setStatus('Enter a valid USDG amount.');

    setLoading(true);
    setStatus('Preparing deposit…');
    setTxSuccess(null);
    try {
      const res = await depositUSDG({
        symbol: vault.symbol,
        amount,
        account: wallet.address,
        provider: wallet.provider,
        onStatus: (msg) => setStatus(msg),
      });
      setTxSuccess({
        type: 'deposit',
        hash: res.hash,
        amount,
      });
      setStatus(null);
      setAmount('');
      // Refresh position
      getUserWellPosition(wallet.provider, vault.symbol, wallet.address).then(setUserPosition);
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
    setStatus('Preparing in-kind exit…');
    setTxSuccess(null);
    try {
      const res = await redeemInKind({
        symbol: vault.symbol,
        shares: amount,
        account: wallet.address,
        provider: wallet.provider,
        onStatus: (msg) => setStatus(msg),
      });
      setTxSuccess({
        type: 'redeem',
        hash: res.hash,
        shares: amount,
      });
      setStatus(null);
      setAmount('');
      // Refresh position
      getUserWellPosition(wallet.provider, vault.symbol, wallet.address).then(setUserPosition);
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

      {userPosition && userPosition.shares > 0 && (
        <div style={{ padding: '0.5rem 0.75rem', background: 'var(--surface-3)', borderRadius: '6px', fontSize: '0.8rem', margin: '0.5rem 0' }}>
          <span>Your Holdings: </span>
          <strong className="tabular">{fmtNum(userPosition.shares, 4)} {vault.shareToken}</strong>
          <span style={{ color: 'var(--txt-dim)' }}> (≈ {fmtUsd(userPosition.usdgValue)})</span>
        </div>
      )}

      <p className="vault-assets">Assets: {vault.assets.join(' + ')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button
          className="btn btn-gold btn-block"
          onClick={() => { setAmount(''); setStatus(null); setTxSuccess(null); setModal('deposit'); }}
        >
          Sink USDG
        </button>
        <button
          className="btn btn-line btn-block"
          onClick={() => { setAmount(''); setStatus(null); setTxSuccess(null); setModal('redeem'); }}
        >
          Redeem In-Kind
        </button>
      </div>

      {demo && <span className="vault-demo">Demo values</span>}

      {modal && (
        <div className="modal-scrim" onClick={() => !loading && setModal(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {txSuccess ? (
              <>
                <h2 style={{ color: 'var(--clr-up)' }}>
                  {txSuccess.type === 'deposit' ? '✅ Deposit Complete!' : '✅ In-Kind Exit Submitted!'}
                </h2>
                <p style={{ margin: '0.75rem 0', fontSize: '0.95rem' }}>
                  {txSuccess.type === 'deposit'
                    ? `Successfully deposited ${txSuccess.amount} USDG into ${vault.name}.`
                    : `Successfully submitted redemption for ${txSuccess.shares} ${vault.shareToken} shares.`}
                </p>
                <div style={{ margin: '1rem 0', padding: '0.75rem', background: 'var(--surface-3)', borderRadius: '8px', wordBreak: 'break-all' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--txt-dim)', display: 'block', marginBottom: '0.25rem' }}>Transaction Hash:</span>
                  <a
                    href={`https://robinhoodchain.blockscout.com/tx/${txSuccess.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--clr-gold)', fontSize: '0.85rem', textDecoration: 'underline' }}
                  >
                    {txSuccess.hash} ↗
                  </a>
                </div>
                <button className="btn btn-gold btn-block btn-lg" onClick={() => { setModal(null); setTxSuccess(null); }}>
                  Close
                </button>
              </>
            ) : (
              <>
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

                {status && (
                  <p className={loading ? 'note' : 'field-err'} role="alert" style={{ color: loading ? 'var(--clr-gold)' : undefined }}>
                    {loading ? `⏳ ${status}` : status}
                  </p>
                )}

                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    className="btn btn-gold btn-block btn-lg"
                    disabled={loading}
                    onClick={modal === 'deposit' ? handleDeposit : handleRedeem}
                  >
                    {loading ? (status || 'Confirming in wallet…') : modal === 'deposit' ? 'Confirm Deposit' : 'Confirm In-Kind Exit'}
                  </button>
                  <button className="btn btn-quiet btn-block" disabled={loading} onClick={() => setModal(null)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
