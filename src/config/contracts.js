// Contract addresses come ONLY from environment variables.
// Nothing is hardcoded: an empty value means "not deployed / not connected yet",
// and the UI shows that state honestly instead of inventing an address.
const env = import.meta.env;
const isAddress = (v) => typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v);

export const CONTRACTS = {
  router: isAddress(env.VITE_ROUTER_ADDRESS) ? env.VITE_ROUTER_ADDRESS : null,
  vaultFactory: isAddress(env.VITE_VAULT_FACTORY_ADDRESS) ? env.VITE_VAULT_FACTORY_ADDRESS : null,
};

export const CONTRACT_LIST = [
  { key: 'router', label: 'Trade router', address: CONTRACTS.router },
  { key: 'vaultFactory', label: 'Vault factory', address: CONTRACTS.vaultFactory },
];

export const hasTradingContracts = Boolean(CONTRACTS.router);
