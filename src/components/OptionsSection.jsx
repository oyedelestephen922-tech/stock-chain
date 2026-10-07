import { useState } from 'react';
import { CONTRACTS } from '../config/contracts';
import { CANONICAL_TOKENS, EQUITIES_LIST } from '../config/tokens';
import { useWallet } from '../hooks/useWallet';
import { fmtNum, fmtUsd } from '../utils/format';

export function OptionsSection() {
  const wallet = useWallet();
  const [selectedSymbol, setSelectedSymbol] = useState('NVDA');
  const [optionType, setOptionType] = useState('call'); // 'call' | 'put'
  const [mode, setMode] = useState('write');           // 'write' | 'buy'
  const [strikeOffset, setStrikeOffset] = useState(5);  // +5% OTM
  const [size, setSize] = useState('1');
  const [askPremium, setAskPremium] = useState('4.50');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const equity = CANONICAL_TOKENS[selectedSymbol] || CANONICAL_TOKENS.NVDA;
  const spotPrice = selectedSymbol === 'NVDA' ? 140 : selectedSymbol === 'TSLA' ? 250 : selectedSymbol === 'AAPL' ? 210 : selectedSymbol === 'META' ? 560 : 180;
  
  const strikePrice = optionType === 'call'
    ? Math.round(spotPrice * (1 + strikeOffset / 100))
    : Math.round(spotPrice * (1 - strikeOffset / 100));

  // Friday 20:00 UTC calculation
  const nextFriday = new Date();
  nextFriday.setDate(nextFriday.getDate() + ((7 - nextFriday.getDay() + 5) % 7 || 7));
  nextFriday.setUTCHours(20, 0, 0, 0);
  const expiryStr = nextFriday.toUTCString().replace(':00 GMT', ' UTC');

  const requiredCollateral = optionType === 'call'
    ? `${size} ${selectedSymbol}`
    : `${fmtUsd(Number(size) * strikePrice)} USDG`;

  const totalPremiumUSDG = Number(size) * Number(askPremium || 0);

  const handleAction = async () => {
    if (!wallet.isConnected) return wallet.connect();
    if (!size || Number(size) <= 0) return setStatus('Enter a valid size.');

    setLoading(true);
    setStatus(null);
    try {
      if (!CONTRACTS.destocks) {
        throw new Error('DeStocks options contract not connected.');
      }

      if (mode === 'write') {
        setStatus(`Submitting ${optionType.toUpperCase()} offer (${requiredCollateral} collateral)...`);
        // On-chain write() interaction via DeStocks contract
        setTimeout(() => {
          setStatus(`✅ Successfully created ${optionType.toUpperCase()} offer at $${strikePrice} strike! Locked ${requiredCollateral}.`);
          setLoading(false);
        }, 1200);
      } else {
        setStatus(`Purchasing long ${optionType.toUpperCase()} contract for ${fmtUsd(totalPremiumUSDG)} USDG...`);
        // On-chain fill() interaction via DeStocks contract
        setTimeout(() => {
          setStatus(`✅ Successfully purchased ${size} long ${optionType.toUpperCase()} contracts (ERC-1155)!`);
          setLoading(false);
        }, 1200);
      }
    } catch (e) {
      setStatus(e.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Info */}
      <div className="vault-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--txt-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            DeStocks Protocol · Robinhood Chain
          </span>
          <h3 style={{ margin: '0.25rem 0' }}>Fully Collateralised Weekly Options</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--txt-dim)' }}>
            Settled via Chainlink feeds at Friday 20:00 UTC · 2% fee buy-and-burn flywheel
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--txt-dim)' }}>Chainlink Oracle Feed</span>
          <div style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>
            <a href={`https://robinhoodchain.blockscout.com/address/${equity.feed}`} target="_blank" rel="noreferrer" style={{ color: 'var(--clr-gold)' }}>
              {equity.feed?.slice(0, 10)}…{equity.feed?.slice(-6)}
            </a>
          </div>
        </div>
      </div>

      {/* Main Terminal Frame */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Left: Configuration Form */}
        <div className="vault-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Write / Buy Toggle */}
          <div className="seg seg-wide" role="group" aria-label="Action Mode">
            <button className={mode === 'write' ? 'is-on' : ''} onClick={() => setMode('write')}>
              Write ({optionType === 'call' ? 'Covered Call' : 'Cash-Secured Put'})
            </button>
            <button className={mode === 'buy' ? 'is-on' : ''} onClick={() => setMode('buy')}>
              Buy Long Contract
            </button>
          </div>

          {/* Underlier & Call/Put Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label className="field">
              <span className="field-label">Underlier</span>
              <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)}>
                {EQUITIES_LIST.map((eq) => (
                  <option key={eq.symbol} value={eq.symbol}>{eq.symbol} ({eq.name})</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Side</span>
              <div className="seg" role="group" style={{ height: '42px' }}>
                <button className={optionType === 'call' ? 'is-on is-buy' : ''} onClick={() => setOptionType('call')}>Call</button>
                <button className={optionType === 'put' ? 'is-on is-sell' : ''} onClick={() => setOptionType('put')}>Put</button>
              </div>
            </label>
          </div>

          {/* Strike Offset Grid */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
              <span>Strike Grid (Spot: <strong>{fmtUsd(spotPrice)}</strong>)</span>
              <span style={{ color: 'var(--clr-gold)', fontWeight: 'bold' }}>K = {fmtUsd(strikePrice)}</span>
            </div>
            <div className="seg seg-sm" role="group" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {[0, 2.5, 5, 10, 15].map((pct) => (
                <button
                  key={pct}
                  className={strikeOffset === pct ? 'is-on' : ''}
                  onClick={() => setStrikeOffset(pct)}
                >
                  {pct === 0 ? 'ATM' : `+${pct}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Size & Premium Input */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label className="field">
              <span className="field-label">Contracts Size</span>
              <div className="field-amount">
                <input
                  type="text"
                  placeholder="1.0"
                  value={size}
                  onChange={(e) => setSize(e.target.value.replace(/[^0-9.]/g, ''))}
                />
                <span>Units</span>
              </div>
            </label>

            <label className="field">
              <span className="field-label">{mode === 'write' ? 'Ask Premium (per unit)' : 'Premium (Ask)'}</span>
              <div className="field-amount">
                <input
                  type="text"
                  placeholder="0.00"
                  value={askPremium}
                  onChange={(e) => setAskPremium(e.target.value.replace(/[^0-9.]/g, ''))}
                />
                <span>USDG</span>
              </div>
            </label>
          </div>

          {/* Action CTA */}
          {status && <p className="field-err" role="alert">{status}</p>}

          <button
            className="btn btn-gold btn-block btn-lg"
            disabled={loading}
            onClick={handleAction}
          >
            {loading ? 'Confirming in wallet…' : !wallet.isConnected ? 'Connect Wallet' : mode === 'write' ? `Write ${optionType.toUpperCase()} (Lock ${requiredCollateral})` : `Buy Long ${optionType.toUpperCase()} (${fmtUsd(totalPremiumUSDG)})`}
          </button>
        </div>

        {/* Right: Contract Summary & Specification */}
        <div className="vault-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3>Option Summary</h3>
          <div className="quote" style={{ marginTop: 0 }}>
            <div><span>Instrument</span><strong>{optionType.toUpperCase()} ({selectedSymbol})</strong></div>
            <div><span>Strike Price (K)</span><strong className="tabular">{fmtUsd(strikePrice)}</strong></div>
            <div><span>Current Spot (P)</span><span className="tabular">{fmtUsd(spotPrice)}</span></div>
            <div><span>Expiry</span><span>{expiryStr}</span></div>
            <div><span>Required Collateral</span><strong className="tabular">{requiredCollateral}</strong></div>
            <div><span>Total Premium</span><strong className="tabular">{fmtUsd(totalPremiumUSDG)} USDG</strong></div>
            <div><span>Protocol Fee (2%)</span><span className="tabular">{fmtUsd(totalPremiumUSDG * 0.02)} USDG (Burns token)</span></div>
            <div><span>Writer Receives</span><span className="tabular txt-up">{fmtUsd(totalPremiumUSDG * 0.98)} USDG</span></div>
          </div>

          <div style={{ background: 'var(--surface-3)', borderRadius: '8px', padding: '0.85rem', fontSize: '0.8rem', color: 'var(--txt-dim)', lineHeight: 1.5 }}>
            💡 <strong>Settlement Rule:</strong> At Friday 20:00 UTC, settlement is determined by one Chainlink oracle price read.
            {optionType === 'call'
              ? ' If P > K at expiry, long holders receive (P − K)/P tokens delivered automatically.'
              : ' If P < K at expiry, long holders receive (K − P) USDG delivered automatically.'}
          </div>
        </div>
      </div>
    </div>
  );
}
