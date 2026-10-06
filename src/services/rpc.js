import { NETWORK } from '../config/network';

let id = 0;

/** Minimal JSON-RPC client for read-only calls to the configured chain. */
export async function rpc(method, params = [], { signal } = {}) {
  const res = await fetch(NETWORK.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
    signal,
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

let cache = { at: 0, promise: null };

/** Live network status: latest block, gas price and chain ID as reported by the RPC.
 *  Several components ask at once, so calls within 5s share one request. */
export function getNetworkStatus() {
  if (cache.promise && Date.now() - cache.at < 5000) return cache.promise;
  cache = { at: Date.now(), promise: fetchNetworkStatus().catch((e) => { cache = { at: 0, promise: null }; throw e; }) };
  return cache.promise;
}

async function fetchNetworkStatus(opts) {
  const [block, gas, chain] = await Promise.all([
    rpc('eth_blockNumber', [], opts),
    rpc('eth_gasPrice', [], opts),
    rpc('eth_chainId', [], opts),
  ]);
  return {
    blockNumber: parseInt(block, 16),
    gasPriceGwei: Number(BigInt(gas)) / 1e9,
    gasPriceWei: BigInt(gas),
    chainId: parseInt(chain, 16),
    matchesConfig: parseInt(chain, 16) === NETWORK.chainId,
  };
}
