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

          <div
            className="hero-contract-space"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginTop: '1.25rem',
              padding: '0.5rem 0.9rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--line, rgba(255, 255, 255, 0.08))',
              borderRadius: '999px',
              fontSize: '0.85rem',
              backdropFilter: 'blur(8px)',
              width: 'fit-content',
            }}
          >
            <span style={{ color: 'var(--txt-dim, #888)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#F59E0B' }} />
              Contract Address:
            </span>
            <span
              style={{
                background: 'rgba(245, 158, 11, 0.12)',
                color: 'var(--clr-gold, #f59e0b)',
                fontWeight: 600,
                padding: '0.15rem 0.6rem',
                borderRadius: '999px',
                letterSpacing: '0.02em',
                fontSize: '0.8rem',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              Coming Soon
            </span>
          </div>

          <dl className="hero-net">
            <div><dt>Network</dt><dd>{NETWORK.name}</dd></div>
            <div><dt>Chain ID</dt><dd>{NETWORK.chainId}</dd></div>
            <div><dt>Contract</dt><dd style={{ color: 'var(--clr-gold, #f59e0b)' }}>Coming Soon</dd></div>
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
