import { useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';

/** Wallet picker (when several EIP-6963 wallets are installed) and wallet error toast. */
export function WalletModal() {
  const w = useWallet();

  useEffect(() => {
    if (!w.pickerOpen) return;
    const esc = (e) => e.key === 'Escape' && w.setPickerOpen(false);
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [w.pickerOpen, w]);

  return (
    <>
      {w.pickerOpen && (
        <div className="modal-scrim" onClick={() => w.setPickerOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="wallet-title">Choose a wallet</h2>
            <p className="dim">Stock Chain never asks for your seed phrase or private key.</p>
            <div className="wallet-list">
              {w.wallets.map((entry) => (
                <button key={entry.info.rdns} className="wallet-option" onClick={() => w.connect(entry)}>
                  {entry.info.icon ? <img src={entry.info.icon} alt="" width="28" height="28" /> : <span className="wallet-option-ph" />}
                  {entry.info.name}
                </button>
              ))}
            </div>
            <button className="btn btn-quiet btn-block" onClick={() => w.setPickerOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      {w.error && (
        <div className="toast" role="alert">
          <span>{w.error}</span>
          <button className="link-btn" onClick={w.clearError} aria-label="Dismiss">Dismiss</button>
        </div>
      )}
    </>
  );
}
