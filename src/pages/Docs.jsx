import { CONTRACT_LIST } from '../config/contracts';
import { NETWORK, explorerAddressUrl } from '../config/network';
import { isDemoMarketData } from '../services/marketData';

const SECTIONS = [
  ['overview', 'Overview'], ['markets', 'Markets'], ['trading', 'Trading'], ['vaults', 'Vaults'], ['fees', 'Fees'],
  ['contracts', 'Smart contracts'], ['security', 'Security'], ['oracles', 'Oracle and data sources'], ['faq', 'FAQ'],
];

function Content({ id }) {
  switch (id) {
    case 'markets':
      return (<>
        <h1>Markets</h1>
        <p>Each market is a tokenized stock or fund that trades on {NETWORK.name}. A market card shows the ticker, issuer name, price, 24-hour change and the trading window (for example 24/5, meaning five days a week around the clock).</p>
        <p>{isDemoMarketData ? 'This build is showing demo prices. They are placeholders for development and must not be read as live quotes.' : 'Prices are exchange prices for the underlying stocks from the connected data provider, refreshed every 15 seconds. On the free Alpaca plan they reflect trades on the IEX exchange. They are not yet the on-chain prices of the stock tokens.'}</p>
      </>);
    case 'trading':
      return (<>
        <h1>Trading</h1>
        <p>The trade terminal quotes a trade before you sign anything. Every quote shows:</p>
        <dl className="doc-dl">
          <dt>Estimated receive</dt><dd>What you should get at the current price.</dd>
          <dt>Minimum after slippage</dt><dd>The least you will accept. If the price moves past this, the trade reverts.</dd>
          <dt>Price impact</dt><dd>How much your order size moves the price against you.</dd>
          <dt>Network fee</dt><dd>Gas paid to {NETWORK.name}, estimated from the live gas price.</dd>
        </dl>
        <p>Your wallet always shows the final transaction for approval. Nothing is sent without your signature.</p>
      </>);
    case 'vaults':
      return (<>
        <h1>Vaults</h1>
        <p>A vault pools deposits into one strategy and gives you shares representing your portion. You can withdraw by redeeming shares. Returns vary with the market and can be negative.</p>
      </>);
    case 'fees':
      return (<>
        <h1>Fees</h1>
        <p>Protocol fees will be published here and enforced in contract code before launch. Until then, the only cost shown in the terminal is the estimated network gas fee.</p>
      </>);
    case 'contracts':
      return (<>
        <h1>Smart contracts</h1>
        <p>Addresses are listed only after deployment and source verification on the <a href={NETWORK.explorerUrl} target="_blank" rel="noreferrer">{NETWORK.name} explorer</a>.</p>
        <div className="contract-table">
          {CONTRACT_LIST.map((c) => (
            <div key={c.key} className="contract-row">
              <span>{c.label}</span>
              <span className={c.address ? 'tabular' : 'dim'}>{c.address ? <a href={explorerAddressUrl(c.address)} target="_blank" rel="noreferrer">{c.address}</a> : 'Not deployed yet'}</span>
            </div>
          ))}
        </div>
        <h2>Network</h2>
        <dl className="doc-dl">
          <dt>Name</dt><dd>{NETWORK.name}</dd>
          <dt>Chain ID</dt><dd>{NETWORK.chainId} ({NETWORK.chainIdHex})</dd>
          <dt>RPC</dt><dd className="mono-wrap">{NETWORK.rpcUrl}</dd>
          <dt>Gas token</dt><dd>{NETWORK.nativeCurrency.symbol}</dd>
        </dl>
      </>);
    case 'security':
      return (<>
        <h1>Security</h1>
        <p>Stock Chain connects to your wallet through the standard EIP-1193 interface. It never requests your seed phrase or private key, and it stores nothing about your wallet except which wallet you last used.</p>
        <p>Before launch, contracts will be audited and the reports linked here. An audit lowers risk but does not remove it.</p>
        <p>If someone claiming to be Stock Chain asks for your seed phrase, it is a scam.</p>
      </>);
    case 'oracles':
      return (<>
        <h1>Oracle and data sources</h1>
        <p>Price oracles for on-chain settlement are not connected yet. When they are, this page will name each feed, its update frequency and what happens if it goes stale.</p>
        <p>Network data (block height and gas price) is read directly from the {NETWORK.name} RPC. Wallet history is read from the Blockscout explorer API.</p>
      </>);
    case 'faq':
      return (<>
        <h1>FAQ</h1>
        <h2>Do I need an account?</h2><p>No. Your wallet is your account.</p>
        <h2>Which wallets work?</h2><p>Any browser wallet that supports EIP-1193, such as MetaMask or Rabby. If several are installed, you can choose.</p>
        <h2>Why does the terminal say contracts are not connected?</h2><p>The trading contracts are not deployed yet. You can explore and preview trades, but nothing can be submitted until they are live and verified.</p>
        <h2>Are the prices real?</h2><p>{isDemoMarketData ? 'Not yet. Prices are clearly marked as demo data until a market data provider is connected.' : 'Yes, from the connected market data provider.'}</p>
      </>);
    default:
      return (<>
        <h1>Overview</h1>
        <p>Stock Chain is an interface for trading tokenized stocks, depositing into strategy vaults and following market strategies on {NETWORK.name}, an EVM-compatible network (chain ID {NETWORK.chainId}).</p>
        <p>Everything settles through smart contracts you can inspect. Your assets stay in your wallet until you sign a transaction.</p>
        <p className="doc-callout">These docs describe the product as it is built. Sections marked “not connected yet” will be updated as contracts and data providers go live.</p>
      </>);
  }
}

export default function Docs({ section }) {
  const id = SECTIONS.some(([k]) => k === section) ? section : 'overview';
  return (
    <section className="section section-first">
      <div className="wrap docs">
        <nav className="docs-nav" aria-label="Documentation">
          <label className="docs-select">
            <span className="sr-only">Jump to section</span>
            <select value={id} onChange={(e) => (window.location.hash = `/docs/${e.target.value}`)}>
              {SECTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <ul>
            {SECTIONS.map(([k, l]) => (
              <li key={k}><a href={`#/docs/${k}`} className={id === k ? 'is-active' : undefined} aria-current={id === k ? 'page' : undefined}>{l}</a></li>
            ))}
          </ul>
        </nav>
        <article className="docs-body"><Content id={id} /></article>
      </div>
    </section>
  );
}
