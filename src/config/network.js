// Network configuration is driven by environment variables (see .env.example).
// Defaults match Robinhood Chain mainnet, chain ID 4663 (0x1237).
const env = import.meta.env;

const chainId = Number(env.VITE_CHAIN_ID || 4663);

export const NETWORK = {
  chainId,
  chainIdHex: '0x' + chainId.toString(16),
  name: env.VITE_CHAIN_NAME || 'Robinhood Chain',
  rpcUrl: env.VITE_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com',
  explorerUrl: (env.VITE_EXPLORER_URL || 'https://robinhoodchain.blockscout.com').replace(/\/$/, ''),
  nativeCurrency: { name: 'Ether', symbol: env.VITE_NATIVE_SYMBOL || 'ETH', decimals: 18 },
};

export const explorerAddressUrl = (addr) => `${NETWORK.explorerUrl}/address/${addr}`;
export const explorerTxUrl = (hash) => `${NETWORK.explorerUrl}/tx/${hash}`;
