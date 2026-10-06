import { NETWORK } from '../config/network';
import { useNetworkStatus } from '../hooks/useData';

/** Shows the configured chain plus live RPC health (real block height from the RPC). */
export function NetworkIndicator({ compact = false }) {
  const { data, error, loading } = useNetworkStatus();
  const state = error ? 'down' : loading && !data ? 'pending' : data?.matchesConfig === false ? 'down' : 'up';
  const label = state === 'up' ? `Block ${data.blockNumber.toLocaleString()}` : state === 'pending' ? 'Connecting…' : 'RPC unreachable';
  return (
    <div className={`net-ind net-${state}`} title={`${NETWORK.name} · chain ID ${NETWORK.chainId} · ${label}`}>
      <span className="net-dot" aria-hidden="true" />
      <span className="net-name">{NETWORK.name}</span>
      {!compact && <span className="net-meta">{label}</span>}
    </div>
  );
}
