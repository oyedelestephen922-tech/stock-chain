import { explorerTxUrl } from '../config/network';
import { useAsync } from '../hooks/useAsync';
import { useWallet } from '../hooks/useWallet';
import { getWalletTransactions } from '../services/history';
import { shortAddress, timeAgo } from '../utils/format';

/** Real wallet activity on the configured chain, read from the Blockscout explorer API. */
export function TxHistory() {
  const { address, isConnected } = useWallet();
  const { data, loading, error } = useAsync(
    (o) => (address ? getWalletTransactions(address, o) : Promise.resolve([])),
    [address],
    { intervalMs: address ? 30000 : 0 }
  );

  return (
    <section className="tx-history" aria-label="Transaction history">
      <h3 className="panel-title">Recent transactions</h3>
      {!isConnected ? (
        <p className="empty-sm">Connect your wallet to see its on-chain activity.</p>
      ) : loading && !data ? (
        <p className="empty-sm">Loading activity…</p>
      ) : error ? (
        <p className="empty-sm">Explorer unavailable right now. Try again shortly.</p>
      ) : !data?.length ? (
        <p className="empty-sm">No transactions yet for {shortAddress(address)}.</p>
      ) : (
        <ul className="tx-list">
          {data.map((tx) => (
            <li key={tx.hash}>
              <a href={explorerTxUrl(tx.hash)} target="_blank" rel="noreferrer">
                <span className="tx-method">{tx.method}</span>
                <span className={`tx-status s-${tx.status.toLowerCase()}`}>{tx.status}</span>
                <span className="tx-hash">{shortAddress(tx.hash)}</span>
                <span className="tx-time">{tx.timestamp ? timeAgo(tx.timestamp) : ''}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
