import { NETWORK } from '../config/network';

/**
 * Real on-chain transaction history for a wallet, from the Blockscout API
 * of the configured explorer. Returns the most recent transactions.
 */
export async function getWalletTransactions(address, { signal } = {}) {
  const res = await fetch(`${NETWORK.explorerUrl}/api/v2/addresses/${address}/transactions`, { signal });
  if (res.status === 404) return []; // address has no activity yet
  if (!res.ok) throw new Error(`Explorer responded ${res.status}`);
  const json = await res.json();
  return (json.items || []).slice(0, 8).map((tx) => ({
    hash: tx.hash,
    method: tx.method || (tx.to?.is_contract ? 'Contract call' : 'Transfer'),
    status: tx.status === 'ok' ? 'Confirmed' : tx.status === 'error' ? 'Failed' : 'Pending',
    timestamp: tx.timestamp,
    direction: tx.from?.hash?.toLowerCase() === address.toLowerCase() ? 'out' : 'in',
  }));
}
