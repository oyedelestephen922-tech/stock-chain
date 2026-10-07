import { useEffect, useState } from 'react';
import { CONTRACTS } from '../config/contracts';
import { useWallet } from '../hooks/useWallet';
import { fmtNum, fmtUsd } from '../utils/format';
import {
  getBorrowData,
  pledgeCollateral,
  borrowUSDG,
  repayUSDG,
  withdrawCollateral,
} from '../services/borrow';

export function BorrowSection() {
  const wallet = useWallet();
  const [tab, setTab] = useState('pledge'); // 'pledge' | 'borrow' | 'repay' | 'withdraw'
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [txSuccess, setTxSuccess] = useState(null);

  // Live on-chain data with fallback
  const [data, setData] = useState({
    pledgedShares: 0,
    currentDebt: 0,
    collateralValue: 0,
    maxBorrowLimit: 0,
    sharePriceUSD: 560,
    deskLiquidityUSDG: 0,
  });

  const refreshData = () => {
    if (wallet.isConnected && wallet.provider && wallet.address) {
      getBorrowData(wallet.provider, wallet.address)
        .then((res) => {
          if (res) setData(res);
        })
        .catch(console.error);
    }
  };

  useEffect(() => {
    refreshData();
  }, [wallet.isConnected, wallet.provider, wallet.address]);

  const pledgedShares = data.pledgedShares;
  const borrowedDebt = data.currentDebt;
  const sharePriceUSD = data.sharePriceUSD || 560;
  const collateralValue = data.collateralValue || pledgedShares * sharePriceUSD;
  const maxBorrowLimit = collateralValue * 0.65; // 65% LTV
  const currentLtvPct = collateralValue > 0 ? (borrowedDebt / collateralValue) * 100 : 0;
  const liquidationThresholdUSD = collateralValue * 0.8; // 80% Liquidation

  const handleSubmit = async () => {
    if (!wallet.isConnected) return wallet.connect();
    const val = Number(amount);
    if (!val || val <= 0) return setStatus('Enter a valid amount.');

    setLoading(true);
    setStatus(`Preparing ${tab} transaction…`);
    setTxSuccess(null);
    try {
      if (!CONTRACTS.creditLine) {
        throw new Error('StonkCreditLine contract not connected yet.');
      }

      let res;
      if (tab === 'pledge') {
        res = await pledgeCollateral({
          shares: amount,
          account: wallet.address,
          provider: wallet.provider,
          onStatus: (msg) => setStatus(msg),
        });
        setTxSuccess({ type: 'pledge', hash: res.hash, amount, unit: 'wMETA' });
      } else if (tab === 'borrow') {
        if (data.deskLiquidityUSDG < val) {
          throw new Error(
            `Insufficient liquidity in borrow desk. Available: ${fmtUsd(data.deskLiquidityUSDG)} USDG.`
          );
        }
        if (borrowedDebt + val > maxBorrowLimit) {
          throw new Error('Borrow amount exceeds 65% max LTV limit.');
        }
        res = await borrowUSDG({
          amount,
          account: wallet.address,
          provider: wallet.provider,
          onStatus: (msg) => setStatus(msg),
        });
        setTxSuccess({ type: 'borrow', hash: res.hash, amount, unit: 'USDG' });
      } else if (tab === 'repay') {
        res = await repayUSDG({
          amount,
          account: wallet.address,
          provider: wallet.provider,
          onStatus: (msg) => setStatus(msg),
        });
        setTxSuccess({ type: 'repay', hash: res.hash, amount, unit: 'USDG' });
      } else if (tab === 'withdraw') {
        if (pledgedShares - val < 0) throw new Error('Insufficient pledged shares.');
        const remainingVal = (pledgedShares - val) * sharePriceUSD;
        if (borrowedDebt > remainingVal * 0.65) {
          throw new Error('Withdrawal would push your debt above the 65% LTV limit.');
        }
        res = await withdrawCollateral({
          shares: amount,
          account: wallet.address,
          provider: wallet.provider,
          onStatus: (msg) => setStatus(msg),
        });
        setTxSuccess({ type: 'withdraw', hash: res.hash, amount, unit: 'wMETA' });
      }

      setStatus(null);
      setAmount('');
      refreshData();
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
          <button className={tab === 'pledge' ? 'is-on' : ''} onClick={() => { setTab('pledge'); setStatus(null); setTxSuccess(null); }}>Pledge Collateral</button>
          <button className={tab === 'borrow' ? 'is-on' : ''} onClick={() => { setTab('borrow'); setStatus(null); setTxSuccess(null); }}>Borrow USDG</button>
          <button className={tab === 'repay' ? 'is-on' : ''} onClick={() => { setTab('repay'); setStatus(null); setTxSuccess(null); }}>Repay Credit</button>
          <button className={tab === 'withdraw' ? 'is-on' : ''} onClick={() => { setTab('withdraw'); setStatus(null); setTxSuccess(null); }}>Withdraw</button>
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

        {status && (
          <p className={loading ? 'note' : 'field-err'} role="alert" style={{ margin: '1rem 0', color: loading ? 'var(--clr-gold)' : undefined }}>
            {loading ? `⏳ ${status}` : status}
          </p>
        )}

        {txSuccess && (
          <div style={{ margin: '1rem 0', padding: '0.75rem', background: 'var(--surface-3)', borderRadius: '8px', wordBreak: 'break-all' }}>
            <span style={{ color: 'var(--clr-up)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>
              ✅ Successfully executed {txSuccess.type} of {txSuccess.amount} {txSuccess.unit}!
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--txt-dim)' }}>Tx: </span>
            <a
              href={`https://robinhoodchain.blockscout.com/tx/${txSuccess.hash}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--clr-gold)', fontSize: '0.85rem', textDecoration: 'underline' }}
            >
              {txSuccess.hash} ↗
            </a>
          </div>
        )}

        <button
          className="btn btn-gold btn-block btn-lg"
          style={{ marginTop: '1.5rem' }}
          disabled={loading}
          onClick={handleSubmit}
        >
          {loading ? (status || 'Processing in wallet…') : !wallet.isConnected ? 'Connect Wallet' : `${tab.charAt(0).toUpperCase() + tab.slice(1)}`}
        </button>

        <p className="note" style={{ textAlign: 'center', marginTop: '1rem' }}>
          Isolated lending desk on Robinhood Chain: Collateral and debt are fully managed by verified smart contract{' '}
          <a
            href={`https://robinhoodchain.blockscout.com/address/${CONTRACTS.creditLine}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--clr-gold)' }}
          >
            {CONTRACTS.creditLine?.slice(0, 8)}…{CONTRACTS.creditLine?.slice(-6)}
          </a>.
        </p>
      </div>
    </div>
  );
}
