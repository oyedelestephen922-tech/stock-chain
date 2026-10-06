import { useEffect, useRef, useState } from 'react';
import { NETWORK, explorerAddressUrl } from '../config/network';
import { useWallet } from '../hooks/useWallet';
import { fmtNum, shortAddress } from '../utils/format';

export function WalletButton({ block = false }) {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!w.isConnected) {
    return (
      <button className={`btn btn-gold${block ? ' btn-block' : ''}`} onClick={() => w.connect()} disabled={w.status === 'connecting'}>
        {w.status === 'connecting' ? 'Check your wallet…' : 'Connect wallet'}
      </button>
    );
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(w.address); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {}
  };

  return (
    <div className="wallet" ref={ref}>
      <button className={`btn btn-ghost wallet-trigger${w.wrongNetwork ? ' is-warn' : ''}${block ? ' btn-block' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <span className="wallet-dot" aria-hidden="true" />
        {shortAddress(w.address)}
      </button>
      {open && (
        <div className="wallet-menu" role="menu">
          <div className="wallet-row"><span>Address</span><button className="link-btn" onClick={copy}>{copied ? 'Copied' : shortAddress(w.address)}</button></div>
          <div className="wallet-row"><span>Network</span><strong className={w.wrongNetwork ? 'txt-down' : ''}>{w.wrongNetwork ? `Chain ${w.chainId}` : NETWORK.name}</strong></div>
          <div className="wallet-row"><span>Balance</span><strong>{w.wrongNetwork ? '--' : `${fmtNum(w.balance, 5)} ${NETWORK.nativeCurrency.symbol}`}</strong></div>
          {w.wrongNetwork && <button className="btn btn-gold btn-block" onClick={w.switchNetwork}>Switch to {NETWORK.name}</button>}
          <a className="btn btn-ghost btn-block" href={explorerAddressUrl(w.address)} target="_blank" rel="noreferrer">View on explorer</a>
          <button className="btn btn-quiet btn-block" onClick={() => { setOpen(false); w.disconnect(); }}>Disconnect</button>
        </div>
      )}
    </div>
  );
}
