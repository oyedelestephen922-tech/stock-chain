import { SectionHead } from './SectionHead';

const STEPS = [
  { n: '01', title: 'Connect', body: 'Connect your wallet and access the Stock Chain ecosystem. No account, no email, no custody.' },
  { n: '02', title: 'Choose', body: 'Select a supported market, trade, vault or strategy, and review the full quote before you sign.' },
  { n: '03', title: 'Settle', body: 'Transactions and applicable settlement logic are executed through blockchain infrastructure and smart contracts.' },
];

export function HowItWorks() {
  return (
    <section className="section" id="how-it-works" aria-labelledby="how-title">
      <div className="wrap">
        <SectionHead id="how-title" title="Three steps from wallet to settlement." />
        <ol className="steps">
          <span className="steps-line" aria-hidden="true"><i /></span>
          {STEPS.map((s) => (
            <li key={s.n} className="step">
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
