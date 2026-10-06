import { NETWORK } from '../config/network';

/**
 * EIP-1193 wallet helpers with EIP-6963 multi-wallet discovery.
 * No keys or seed phrases are ever requested, read or stored. The only thing
 * persisted is the id of the last wallet used, so we can offer a quick reconnect.
 */

const discovered = new Map(); // rdns -> { info, provider }
const listeners = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('eip6963:announceProvider', (e) => {
    const { info, provider } = e.detail || {};
    if (!info?.rdns || !provider) return;
    discovered.set(info.rdns, { info, provider });
    listeners.forEach((fn) => fn());
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

export function listWallets() {
  const list = [...discovered.values()];
  if (!list.length && typeof window !== 'undefined' && window.ethereum) {
    list.push({ info: { rdns: 'injected', name: 'Browser wallet', icon: null }, provider: window.ethereum });
  }
  return list;
}

export function onWalletsChanged(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function requestAccounts(provider) {
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  return accounts?.[0] || null;
}

export async function silentAccount(provider) {
  const accounts = await provider.request({ method: 'eth_accounts' });
  return accounts?.[0] || null;
}

export async function getChainId(provider) {
  return parseInt(await provider.request({ method: 'eth_chainId' }), 16);
}

export async function getBalance(provider, address) {
  return provider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
}

export async function switchToConfiguredChain(provider) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: NETWORK.chainIdHex }] });
  } catch (err) {
    // 4902 = chain not added to the wallet yet
    if (err?.code === 4902 || err?.data?.originalError?.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: NETWORK.chainIdHex,
          chainName: NETWORK.name,
          nativeCurrency: NETWORK.nativeCurrency,
          rpcUrls: [NETWORK.rpcUrl],
          blockExplorerUrls: [NETWORK.explorerUrl],
        }],
      });
    } else {
      throw err;
    }
  }
}

export async function revokePermissions(provider) {
  try {
    await provider.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
  } catch {
    /* not every wallet supports revocation; local disconnect still applies */
  }
}

export function friendlyWalletError(err) {
  if (!err) return 'Something went wrong with the wallet request.';
  if (err.code === 4001) return 'Request rejected in your wallet.';
  if (err.code === -32002) return 'Your wallet already has a pending request. Open it to continue.';
  return err.message || 'Wallet request failed.';
}
