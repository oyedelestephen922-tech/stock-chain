import { SectionHead } from './SectionHead';

const POINTS = [
  'Non-custodial architecture where applicable',
  'Transparent smart contracts',
  'On-chain settlement where applicable',
  'Wallet-based authentication',
  'No private-key collection, ever',
  'Auditable transaction history',
];

export function SecuritySection() {
  return (
    <section className="section section-security" aria-labelledby="sec-title">
      <div className="wrap security">
        <SectionHead id="sec-title" title="Your assets. Your wallet. Your control." sub="Stock Chain is designed so you sign every action yourself. We never hold your keys, and you can verify what the contracts do before using them." />
        <ul className="checks">
          {POINTS.map((p) => (
            <li key={p}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>{p}</li>
          ))}
        </ul>
        <p className="disclaimer security-note">Smart contracts and tokenized assets carry risk, including bugs, oracle failures, market volatility and loss of funds. Only use what you can afford to lose, and read the docs before you trade.</p>
      </div>
    </section>
  );
}
