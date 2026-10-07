import { useState } from 'react';
import { CONTRACTS } from '../config/contracts';
import { useWallet } from '../hooks/useWallet';
import { fmtNum, fmtUsd } from '../utils/format';

export function BorrowSection() {
  const wallet = useWallet();
  const [tab, setTab] = useState('pledge'); // 'pledge' | 'borrow' | 'repay' | 'withdraw'
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // Demo / local state for user collateral and borrow balance
  const [pledgedShares, setPledgedShares] = useState(12.5); // wMETA shares
  const [borrowedDebt, setBorrowedDebt] = useState(2400);   // USDG
  const sharePriceUSD = 560; // wMETA share price estimate
  const collateralValue = pledgedShares * sharePriceUSD;
  const maxBorrowLimit = collateralValue * 0.65; // 65% LTV
  const currentLtvPct = collateralValue > 0 ? (borrowedDebt / collateralValue) * 100 : 0;
  const liquidationThresholdUSD = collateralValue * 0.80; // 80% Liquidation

  const handleSubmit = async () => {
    if (!wallet.isConnected) return wallet.connect();
    const val = Number(amount);
    if (!val || val <= 0) return setStatus('Enter a valid amount.');

    setLoading(true);
    setStatus(null);
    try {
      if (!CONTRACTS.creditLine) {
        throw new Error('StonkCreditLine contract not connected yet. Run `npm run deploy:all`.');
      }

      if (tab === 'pledge') {
        setPledgedShares((prev) => prev + val);
        setStatus(`Successfully pledged ${val} wMETA collateral!`);
      } else if (tab === 'borrow') {
        if (borrowedDebt + val > maxBorrowLimit) {
          throw new Error('Borrow amount exceeds 65% max LTV limit.');
        }
        setBorrowedDebt((prev) => prev + val);
        setStatus(`Successfully borrowed ${val} USDG credit!`);
      } else if (tab === 'repay') {
        setBorrowedDebt((prev) => Math.max(0, prev - val));
        setStatus(`Successfully repaid ${val} USDG credit!`);
      } else if (tab === 'withdraw') {
        if (pledgedShares - val < 0) throw new Error('Insufficient pledged shares.');
        const remainingVal = (pledgedShares - val) * sharePriceUSD;
        if (borrowedDebt > remainingVal * 0.65) {
          throw new Error('Withdrawal would push your debt above the 65% LTV limit.');
        }
        setPledgedShares((prev) => prev - val);
        setStatus(`Successfully withdrew ${val} wMETA shares!`);
      }
      setAmount('');
    } catch (e) {
      setStatus(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Account Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="vault-card">
          <dt style={{ color: 'var(--txt-dim)', fontSize: '0.85rem' }}>Pledged Collateral</dt>
          <dd style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0' }}>{fmtNum(pledgedShares, 2)} wMETA</dd>
          <span style={{ fontSize: '0.85rem', color: 'var(--txt-dim)' }}>≈ {fmtUsd(collateralValue)} USDG</span>
        </div>

        <div className="vault-card">
          <dt style={{ color: 'var(--txt-dim)', fontSize: '0.85rem' }}>Outstanding Credit</dt>
          <dd style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0' }}>{fmtUsd(borrowedDebt)}</dd>
          <span style={{ fontSize: '0.85rem', color: 'var(--txt-dim)' }}>Base APR: <strong>4.85%</strong></span>
        </div>

        <div className="vault-card">
          <dt style={{ color: 'var(--txt-dim)', fontSize: '0.85rem' }}>Borrow Limit (65% LTV)</dt>
          <dd style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0' }}>{fmtUsd(maxBorrowLimit)}</dd>
          <span style={{ fontSize: '0.85rem', color: currentLtvPct > 60 ? 'var(--clr-down)' : 'var(--clr-up)' }}>
            Current LTV: {currentLtvPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* LTV Safety Meter */}
      <div className="vault-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
          <span>Risk Level: <strong>{currentLtvPct > 70 ? 'High' : currentLtvPct > 50 ? 'Moderate' : 'Safe'}</strong></span>
          <span>Liquidation at 80% LTV ({fmtUsd(liquidationThresholdUSD)})</span>
        </div>
        <div style={{ width: '100%', height: '10px', background: 'var(--surface-3)', borderRadius: '5px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(100, currentLtvPct)}%`,
              height: '100%',
              background: currentLtvPct > 75 ? '#F43F5E' : currentLtvPct > 55 ? '#F59E0B' : '#10B981',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Action Desk Tabs */}
      <div className="vault-card" style={{ padding: '2rem' }}>
        <div className="seg seg-wide" role="group" aria-label="Desk action" style={{ marginBottom: '1.5rem' }}>
          <button className={tab === 'pledge' ? 'is-on' : ''} onClick={() => setTab('pledge')}>Pledge Collateral</button>
          <button className={tab === 'borrow' ? 'is-on' : ''} onClick={() => setTab('borrow')}>Borrow USDG</button>
          <button className={tab === 'repay' ? 'is-on' : ''} onClick={() => setTab('repay')}>Repay Credit</button>
          <button className={tab === 'withdraw' ? 'is-on' : ''} onClick={() => setTab('withdraw')}>Withdraw</button>
        </div>

        <label className="field">
          <span className="field-label">
            {tab === 'pledge' || tab === 'withdraw' ? 'wMETA Shares Amount' : 'USDG Credit Amount'}
          </span>
          <div className="field-amount">
            <input
              type="text"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            />
            <span>{tab === 'pledge' || tab === 'withdraw' ? 'wMETA' : 'USDG'}</span>
          </div>
        </label>

        {status && <p className="field-err" role="alert" style={{ margin: '1rem 0' }}>{status}</p>}

        <button
          className="btn btn-gold btn-block btn-lg"
          style={{ marginTop: '1.5rem' }}
          disabled={loading}
          onClick={handleSubmit}
        >
          {loading ? 'Processing…' : !wallet.isConnected ? 'Connect Wallet' : `${tab.charAt(0).toUpperCase() + tab.slice(1)}`}
        </button>

        <p className="note" style={{ textAlign: 'center', marginTop: '1rem' }}>
          Isolated lending desk: Liquidations are isolated to this specific vault pool.
        </p>
      </div>
    </div>
  );
}
