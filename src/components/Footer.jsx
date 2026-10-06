import { SOCIALS } from '../config/site';
import { LogoMark } from './Logo';

const LINKS = [
  ['Markets', '#/markets'], ['Trade', '#/trade'], ['Vaults', '#/vaults'], ['Docs', '#/docs'],
  ['Contracts', '#/docs/contracts'], ['Security', '#/docs/security'], ['Terms', '#/terms'], ['Privacy', '#/privacy'],
];

export function Footer({ reduced, onToggleMotion }) {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div className="footer-brand">
          <LogoMark size={56} />
          <p className="footer-word shimmer-text">Stock Chain</p>
          <p className="footer-tag">The financial markets, connected.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          {LINKS.map(([l, h]) => <a key={l} href={h}>{l}</a>)}
        </nav>
        {SOCIALS.length > 0 && (
          <nav className="footer-social" aria-label="Social">
            {SOCIALS.map((s) => <a key={s.key} href={s.url} target="_blank" rel="noreferrer">{s.label}</a>)}
          </nav>
        )}
      </div>
      <div className="wrap footer-base">
        <span>© {new Date().getFullYear()} Stock Chain. Tokenized assets carry risk. Nothing here is investment advice.</span>
        <button className="link-btn" onClick={onToggleMotion} aria-pressed={reduced}>{reduced ? 'Enable animations' : 'Reduce motion'}</button>
      </div>
    </footer>
  );
}
