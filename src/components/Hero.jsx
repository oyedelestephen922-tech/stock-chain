import { useState } from 'react';
import { NETWORK } from '../config/network';
import { CONTRACTS } from '../config/contracts';
import { useNetworkStatus } from '../hooks/useData';
import { useWallet } from '../hooks/useWallet';
import { MarketCore } from './MarketCore';

export function Hero({ reduced }) {
  const net = useNetworkStatus();
  const wallet = useWallet();
  const live = net.data?.matchesConfig;
  const [copied, setCopied] = useState(false);

  const tokenAddress = CONTRACTS.token || '0xa536b11f478d6588158481b1cb0e1b66b3c627f8';
  const explorerUrl = `https://robinhoodchain.blockscout.com/token/${tokenAddress}`;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(tokenAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
              flexWrap: 'wrap',
              gap: '0.65rem',
              marginTop: '1.25rem',
              padding: '0.45rem 0.9rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--line, rgba(255, 255, 255, 0.08))',
              borderRadius: '999px',
              fontSize: '0.85rem',
              backdropFilter: 'blur(8px)',
              width: 'fit-content',
            }}
          >
            <span style={{ color: 'var(--txt-dim, #888)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }} />
              $CHAIN Token:
            </span>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: 'monospace',
                color: 'var(--clr-gold, #f59e0b)',
                fontWeight: 600,
                fontSize: '0.82rem',
                textDecoration: 'none',
              }}
              title="View on Robinhood Blockscout"
            >
              {tokenAddress.slice(0, 6)}…{tokenAddress.slice(-4)} ↗
            </a>
            <button
              onClick={handleCopy}
              className="btn btn-line"
              style={{
                padding: '0.15rem 0.5rem',
                fontSize: '0.75rem',
                borderRadius: '999px',
                height: 'auto',
                lineHeight: '1.3',
                background: copied ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                borderColor: copied ? '#10B981' : undefined,
                color: copied ? '#10B981' : 'inherit',
              }}
              title="Copy token address"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <dl className="hero-net">
            <div><dt>Network</dt><dd>{NETWORK.name}</dd></div>
            <div><dt>Chain ID</dt><dd>{NETWORK.chainId}</dd></div>
            <div>
              <dt>$CHAIN Token</dt>
              <dd>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--clr-gold, #f59e0b)', textDecoration: 'none' }}
                >
                  {tokenAddress.slice(0, 6)}…{tokenAddress.slice(-4)} ↗
                </a>
              </dd>
            </div>
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
