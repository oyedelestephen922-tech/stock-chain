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
  const [statusText, setStatusText] = useState('');
  const [txSuccess, setTxSuccess] = useState(null);

  const market = markets.find((m) => m.symbol === symbol);
  const slip = custom ? Math.min(50, Math.max(0.01, Number(custom) || 0)) : slippage;
  const quote = useMemo(
    () => getQuote({ side, amount, price: market?.price, slippagePct: slip, gasPriceWei: net.data?.gasPriceWei }),
    [side, amount, market, slip, net.data]
  );

  useEffect(() => { setAmount(''); setTxError(null); setTxSuccess(null); }, [symbol, side]);

  const amountUnit = side === 'buy' ? 'USD' : symbol;
  const receiveUnit = side === 'buy' ? symbol : 'USD';
  const invalid = amount !== '' && !(Number(amount) > 0);

  let cta = { label: side === 'buy' ? `Buy ${symbol}` : `Sell ${symbol}`, action: () => { setTxError(null); setTxSuccess(null); setPreview(true); }, disabled: !quote || invalid };
  if (!wallet.isConnected) cta = { label: 'Connect wallet', action: () => wallet.connect(), disabled: false };
  else if (wallet.wrongNetwork) cta = { label: `Switch to ${NETWORK.name}`, action: wallet.switchNetwork, disabled: false };

  const confirm = async () => {
    setSubmitting(true);
    setTxError(null);
    setStatusText('Preparing transaction…');
    try {
      const res = await executeTrade({
        side,
        symbol,
        amount,
        minReceive: quote.minReceive,
        account: wallet.address,
        provider: wallet.provider,
        onStatus: (msg) => setStatusText(msg),
      });
      setTxSuccess({
        hash: res.hash,
        side,
        amount,
        symbol,
        receive: quote.receive,
      });
      setAmount('');
    } catch (e) {
      setTxError(e.message);
    } finally {
      setSubmitting(false);
      setStatusText('');
    }
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

      {preview && (
        <div className="modal-scrim" onClick={() => !submitting && setPreview(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="preview-title" onClick={(e) => e.stopPropagation()}>
            {txSuccess ? (
              <>
                <h2 id="preview-title" style={{ color: 'var(--clr-up)' }}>✅ Trade Executed!</h2>
                <p style={{ margin: '0.75rem 0', fontSize: '0.95rem' }}>
                  Successfully executed swap of <strong>{fmtNum(Number(txSuccess.amount), 4)} {txSuccess.side === 'buy' ? 'USDG' : txSuccess.symbol}</strong> for estimated <strong>{fmtNum(txSuccess.receive, 4)} {txSuccess.side === 'buy' ? txSuccess.symbol : 'USDG'}</strong> on Robinhood Chain.
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
                <button className="btn btn-gold btn-block btn-lg" onClick={() => { setPreview(false); setTxSuccess(null); }}>
                  Close
                </button>
              </>
            ) : quote ? (
              <>
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
                {statusText && <p className="note" style={{ color: 'var(--clr-gold)', fontWeight: 500 }}>⏳ {statusText}</p>}
                {txError && <p className="field-err" role="alert">{txError}</p>}
                <button className="btn btn-gold btn-block btn-lg" onClick={confirm} disabled={submitting || !hasTradingContracts}>
                  {submitting ? (statusText || 'Confirm in your wallet…') : hasTradingContracts ? 'Confirm trade' : 'Confirm trade (contracts not connected)'}
                </button>
                <button className="btn btn-quiet btn-block" disabled={submitting} onClick={() => setPreview(false)}>Back</button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
