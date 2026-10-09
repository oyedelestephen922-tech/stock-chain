import { NETWORK } from '../config/network';
import { useNetworkStatus } from '../hooks/useData';
import { useWallet } from '../hooks/useWallet';
import { MarketCore } from './MarketCore';

export function Hero({ reduced }) {
  const net = useNetworkStatus();
  const wallet = useWallet();
  const live = net.data?.matchesConfig;

  return (
    <section className="hero">
      <div className="hero-grid" aria-hidden="true" />
      <div className="wrap hero-inner">
        <div className="hero-copy">
          <p className={`hero-status${live ? ' is-live' : ''}`}>
            <span className="pulse" aria-hidden="true" />
            {live ? 'Live on-chain' : net.error ? 'Network unreachable' : 'Connecting to network'}
          </p>
          <h1 className="hero-title shimmer-text">The stock market. Rebuilt on-chain.</h1>
          <p className="hero-sub">
            Trade, earn and interact with tokenized markets through transparent blockchain
            infrastructure built for the next generation of investors.
          </p>
          <div className="hero-ctas">
            <a href="#/markets" className="btn btn-gold btn-lg">Explore markets</a>
            {wallet.isConnected
              ? <a href="#/trade" className="btn btn-ghost btn-lg">Open terminal</a>
              : <button className="btn btn-ghost btn-lg" onClick={() => wallet.connect()}>Connect wallet</button>}
          </div>

          <dl className="hero-net">
            <div><dt>Network</dt><dd>{NETWORK.name}</dd></div>
            <div><dt>Chain ID</dt><dd>{NETWORK.chainId}</dd></div>
            <div><dt>Latest block</dt><dd className="tabular">{net.data ? net.data.blockNumber.toLocaleString() : '--'}</dd></div>
          </dl>
        </div>
        <div className="hero-visual">
          <MarketCore reduced={reduced} />
        </div>
      </div>
    </section>
  );
}
