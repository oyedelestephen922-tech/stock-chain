import { useEffect, useMemo, useState } from 'react';
import { NETWORK } from '../config/network';
import { hasTradingContracts } from '../config/contracts';
import { useNetworkStatus } from '../hooks/useData';
import { useWallet } from '../hooks/useWallet';
import { executeTrade, getQuote } from '../services/trade';
import { fmtNum, fmtUsd } from '../utils/format';
import { DemoBadge } from './DemoBadge';

const SLIPPAGES = [0.1, 0.5, 1];

export function TradePanel({ markets = [], symbol, onSymbol, demo }) {
  const wallet = useWallet();
  const net = useNetworkStatus();
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [custom, setCustom] = useState('');
  const [preview, setPreview] = useState(false);
  const [txError, setTxError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const market = markets.find((m) => m.symbol === symbol);
  const slip = custom ? Math.min(50, Math.max(0.01, Number(custom) || 0)) : slippage;
  const quote = useMemo(
    () => getQuote({ side, amount, price: market?.price, slippagePct: slip, gasPriceWei: net.data?.gasPriceWei }),
    [side, amount, market, slip, net.data]
  );

  useEffect(() => { setAmount(''); setTxError(null); }, [symbol, side]);

  const amountUnit = side === 'buy' ? 'USD' : symbol;
  const receiveUnit = side === 'buy' ? symbol : 'USD';
  const invalid = amount !== '' && !(Number(amount) > 0);

  let cta = { label: side === 'buy' ? `Buy ${symbol}` : `Sell ${symbol}`, action: () => { setTxError(null); setPreview(true); }, disabled: !quote || invalid };
  if (!wallet.isConnected) cta = { label: 'Connect wallet', action: () => wallet.connect(), disabled: false };
  else if (wallet.wrongNetwork) cta = { label: `Switch to ${NETWORK.name}`, action: wallet.switchNetwork, disabled: false };

  const confirm = async () => {
    setSubmitting(true); setTxError(null);
    try { await executeTrade({ side, symbol, amount, minReceive: quote.minReceive, account: wallet.address }); }
    catch (e) { setTxError(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <section className="trade-panel" aria-label="Trade">
      <div className="seg seg-wide" role="group" aria-label="Order side">
        <button className={side === 'buy' ? 'is-on is-buy' : ''} onClick={() => setSide('buy')} aria-pressed={side === 'buy'}>Buy</button>
        <button className={side === 'sell' ? 'is-on is-sell' : ''} onClick={() => setSide('sell')} aria-pressed={side === 'sell'}>Sell</button>
      </div>

      <label className="field">
        <span className="field-label">Asset</span>
        <select value={symbol} onChange={(e) => onSymbol(e.target.value)}>
          {markets.map((m) => <option key={m.symbol} value={m.symbol}>{m.symbol} · {m.name}</option>)}
        </select>
      </label>

      <div className="trade-price">
        <span>Price {demo && <DemoBadge>Demo</DemoBadge>}</span>
        <strong className="tabular">{fmtUsd(market?.price)}</strong>
      </div>

      <label className="field">
        <span className="field-label">Amount ({amountUnit})</span>
        <div className={`field-amount${invalid ? ' is-invalid' : ''}`}>
          <input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} aria-invalid={invalid} />
          <span>{amountUnit}</span>
        </div>
        {invalid && <span className="field-err">Enter an amount greater than zero.</span>}
      </label>

      <div className="quote">
        <div><span>Estimated receive</span><strong className="tabular">{quote ? `${fmtNum(quote.receive, side === 'buy' ? 6 : 2)} ${receiveUnit}` : '--'}</strong></div>
        <div><span>Minimum after slippage</span><span className="tabular">{quote ? `${fmtNum(quote.minReceive, side === 'buy' ? 6 : 2)} ${receiveUnit}` : '--'}</span></div>
        <div><span>Price impact (est.)</span><span className={`tabular ${quote?.impactPct > 2 ? 'txt-down' : ''}`}>{quote ? `${quote.impactPct.toFixed(3)}%` : '--'}</span></div>
        <div><span>Network fee (est.)</span><span className="tabular">{quote?.feeEth != null ? `${quote.feeEth.toFixed(8)} ${NETWORK.nativeCurrency.symbol}` : net.error ? 'Unavailable' : '--'}</span></div>
        <div className="quote-slip">
          <span>Slippage</span>
          <div className="seg seg-sm" role="group" aria-label="Slippage tolerance">
            {SLIPPAGES.map((s) => (
              <button key={s} className={!custom && slippage === s ? 'is-on' : ''} onClick={() => { setCustom(''); setSlippage(s); }}>{s}%</button>
            ))}
            <input className="slip-input" inputMode="decimal" placeholder="Custom" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Custom slippage percent" />
          </div>
        </div>
      </div>

      <button className={`btn btn-gold btn-block btn-lg ${side === 'sell' && wallet.isConnected && !wallet.wrongNetwork ? 'btn-sell' : ''}`} onClick={cta.action} disabled={cta.disabled}>{cta.label}</button>
      {!hasTradingContracts && <p className="note">Trading contracts are not deployed yet. You can preview a trade, but nothing will be submitted.</p>}

      {preview && quote && (
        <div className="modal-scrim" onClick={() => setPreview(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="preview-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="preview-title">Review {side === 'buy' ? 'purchase' : 'sale'}</h2>
            <div className="quote">
              <div><span>You pay</span><strong className="tabular">{fmtNum(Number(amount), 6)} {amountUnit}</strong></div>
              <div><span>You receive (est.)</span><strong className="tabular">{fmtNum(quote.receive, 6)} {receiveUnit}</strong></div>
              <div><span>Minimum received</span><span className="tabular">{fmtNum(quote.minReceive, 6)} {receiveUnit}</span></div>
              <div><span>Execution price (est.)</span><span className="tabular">{fmtUsd(quote.execPrice)}</span></div>
              <div><span>Slippage tolerance</span><span>{slip}%</span></div>
              <div><span>Network</span><span>{NETWORK.name}</span></div>
            </div>
            {demo && <p className="note">This quote uses demo prices. It is not an executable price.</p>}
            {txError && <p className="field-err" role="alert">{txError}</p>}
            <button className="btn btn-gold btn-block btn-lg" onClick={confirm} disabled={submitting || !hasTradingContracts}>
              {submitting ? 'Confirm in your wallet…' : hasTradingContracts ? 'Confirm trade' : 'Confirm trade (contracts not connected)'}
            </button>
            <button className="btn btn-quiet btn-block" onClick={() => setPreview(false)}>Back</button>
          </div>
        </div>
      )}
    </section>
  );
}
