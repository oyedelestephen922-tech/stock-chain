import { CONTRACT_LIST } from '../config/contracts';
import { NETWORK, explorerAddressUrl } from '../config/network';
import { shortAddress } from '../utils/format';
import { SectionHead } from './SectionHead';

const PILLARS = [
  { title: 'Smart contracts', body: 'Trading and vault logic lives in contracts anyone can read.' },
  { title: 'Verified source', body: 'Contract source is published and verified on the explorer before launch.' },
  { title: 'On-chain transactions', body: 'Every trade and deposit leaves a public, permanent record.' },
  { title: 'Transparent fees', body: 'Fees are shown before you sign and enforced by contract code.' },
  { title: 'Oracle and data', body: 'Price sources are named in the docs, with their update rules.' },
];

export function Transparency() {
  const deployed = CONTRACT_LIST.filter((c) => c.address);
  return (
    <section className="section section-verify" aria-labelledby="verify-title">
      <div className="wrap verify">
        <div>
          <SectionHead id="verify-title" title="Built to be verified." sub="Don’t take our word for it. Check the code, the contracts and the transactions yourself." />
          <div className="verify-ctas">
            {deployed[0]
              ? <a className="btn btn-gold" href={explorerAddressUrl(deployed[0].address)} target="_blank" rel="noreferrer">View contract</a>
              : <button className="btn btn-gold" disabled title="No contract is deployed yet">View contract</button>}
            <a className="btn btn-ghost" href={NETWORK.explorerUrl} target="_blank" rel="noreferrer">View on explorer</a>
            <a className="btn btn-quiet" href="#/docs/contracts">Read documentation</a>
          </div>
        </div>
        <div className="verify-board">
          <ul className="pillars">
            {PILLARS.map((p) => <li key={p.title}><h3>{p.title}</h3><p>{p.body}</p></li>)}
          </ul>
          <div className="contract-table" role="table" aria-label="Deployed contracts">
            {CONTRACT_LIST.map((c) => (
              <div key={c.key} role="row" className="contract-row">
                <span role="cell">{c.label}</span>
                <span role="cell" className={c.address ? 'tabular' : 'dim'}>
                  {c.address ? <a href={explorerAddressUrl(c.address)} target="_blank" rel="noreferrer">{shortAddress(c.address)}</a> : 'Not deployed yet'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
