import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { NetworkIndicator } from './NetworkIndicator';
import { ThemeToggle } from './ThemeToggle';
import { WalletButton } from './WalletButton';

const LINKS = [
  { label: 'Markets', to: '#/markets', page: 'markets' },
  { label: 'Trade', to: '#/trade', page: 'trade' },
  { label: 'Vaults', to: '#/vaults', page: 'vaults' },
  { label: 'How it works', to: '#/#how-it-works', page: null },
  { label: 'Docs', to: '#/docs', page: 'docs' },
];

export function Navbar({ route, theme, onToggleTheme }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => setOpen(false), [route.page, route.param, route.anchor]);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; }, [open]);

  return (
    <>
    <header className={`nav${scrolled ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
      <div className="nav-inner wrap">
        <a href="#/" className="nav-brand" aria-label="Stock Chain home"><Logo /></a>
        <nav className="nav-links" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.label} href={l.to} className={route.page === l.page ? 'is-active' : undefined} aria-current={route.page === l.page ? 'page' : undefined}>{l.label}</a>
          ))}
        </nav>
        <div className="nav-actions">
          <NetworkIndicator compact />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <div className="nav-wallet"><WalletButton /></div>
          <button className="icon-btn nav-burger" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            <span /><span />
          </button>
        </div>
      </div>
    </header>
    {/* Drawer lives outside <header>: the header's backdrop blur would otherwise trap this fixed panel. */}
    <div className={`nav-drawer${scrolled ? ' is-compact' : ''}`} hidden={!open}>
        <nav aria-label="Mobile">
          {LINKS.map((l, i) => (
            <a key={l.label} href={l.to} style={{ '--i': i }}>{l.label}</a>
          ))}
        </nav>
        <div className="nav-drawer-foot">
          <NetworkIndicator />
          <WalletButton block />
        </div>
    </div>
    </>
  );
}
