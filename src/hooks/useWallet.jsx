import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NETWORK } from '../config/network';
import {
  friendlyWalletError, getBalance, getChainId, listWallets, onWalletsChanged,
  requestAccounts, revokePermissions, silentAccount, switchToConfiguredChain,
} from '../lib/wallet';
import { weiHexToEth } from '../utils/format';

const WalletContext = createContext(null);
const LAST_KEY = 'sc-last-wallet';

export function WalletProvider({ children }) {
  const [wallets, setWallets] = useState(listWallets);
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | error
  const [error, setError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const providerRef = useRef(null);

  useEffect(() => onWalletsChanged(() => setWallets(listWallets())), []);

  const refreshBalance = useCallback(async (p = providerRef.current, a = address) => {
    if (!p || !a) return;
    try { setBalance(weiHexToEth(await getBalance(p, a))); } catch { setBalance(null); }
  }, [address]);

  const attach = useCallback(async (entry, account) => {
    const p = entry.provider;
    providerRef.current = p;
    setAddress(account);
    const cid = await getChainId(p);
    setChainId(cid);
    setStatus('connected');
    try { localStorage.setItem(LAST_KEY, entry.info.rdns); } catch {}
    setBalance(weiHexToEth(await getBalance(p, account).catch(() => null)));
  }, []);

  const connect = useCallback(async (entry) => {
    setError(null);
    if (!entry) {
      const list = listWallets();
      if (list.length === 0) { setError('No browser wallet found. Install an EIP-1193 wallet such as MetaMask or Rabby, then reload.'); setStatus('error'); return; }
      if (list.length > 1) { setPickerOpen(true); return; }
      entry = list[0];
    }
    setPickerOpen(false);
    setStatus('connecting');
    try {
      const account = await requestAccounts(entry.provider);
      if (!account) throw new Error('No account was shared by the wallet.');
      await attach(entry, account);
    } catch (err) {
      setError(friendlyWalletError(err));
      setStatus(address ? 'connected' : 'error');
    }
  }, [attach, address]);

  const disconnect = useCallback(async () => {
    const p = providerRef.current;
    providerRef.current = null;
    setAddress(null); setChainId(null); setBalance(null); setStatus('idle'); setError(null);
    try { localStorage.removeItem(LAST_KEY); } catch {}
    if (p) await revokePermissions(p);
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!providerRef.current) return;
    setError(null);
    try { await switchToConfiguredChain(providerRef.current); } catch (err) { setError(friendlyWalletError(err)); }
  }, []);

  // Quiet reconnect if the user previously connected and the wallet still authorises us.
  useEffect(() => {
    let last; try { last = localStorage.getItem(LAST_KEY); } catch {}
    if (!last) return;
    const entry = wallets.find((w) => w.info.rdns === last);
    if (!entry || providerRef.current) return;
    silentAccount(entry.provider).then((a) => a && attach(entry, a)).catch(() => {});
  }, [wallets, attach]);

  // Wallet events
  useEffect(() => {
    const p = providerRef.current;
    if (!p?.on) return;
    const onAccounts = (accs) => { if (!accs?.length) disconnect(); else { setAddress(accs[0]); refreshBalance(p, accs[0]); } };
    const onChain = (hex) => { setChainId(parseInt(hex, 16)); refreshBalance(); };
    p.on('accountsChanged', onAccounts);
    p.on('chainChanged', onChain);
    return () => { p.removeListener?.('accountsChanged', onAccounts); p.removeListener?.('chainChanged', onChain); };
  }, [address, disconnect, refreshBalance]);

  const value = useMemo(() => ({
    wallets, address, chainId, balance, status, error, pickerOpen,
    isConnected: status === 'connected' && !!address,
    wrongNetwork: status === 'connected' && chainId != null && chainId !== NETWORK.chainId,
    connect, disconnect, switchNetwork, setPickerOpen, clearError: () => setError(null),
    provider: providerRef.current,
  }), [wallets, address, chainId, balance, status, error, pickerOpen, connect, disconnect, switchNetwork]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export const useWallet = () => useContext(WalletContext);
