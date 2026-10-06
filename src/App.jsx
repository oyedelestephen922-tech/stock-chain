import { Suspense, lazy, useEffect } from 'react';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { WalletModal } from './components/WalletModal';
import { useMotion } from './hooks/useMotion';
import { useRoute } from './hooks/useRoute';
import { useTheme } from './hooks/useTheme';
import Home from './pages/Home';

const Markets = lazy(() => import('./pages/Markets'));
const Trade = lazy(() => import('./pages/Trade'));
const Vaults = lazy(() => import('./pages/Vaults'));
const Docs = lazy(() => import('./pages/Docs'));
const Legal = lazy(() => import('./pages/Legal'));
const NotFound = lazy(() => import('./pages/NotFound'));

const TITLES = { home: 'Markets, connected on-chain', markets: 'Markets', trade: 'Trade', vaults: 'Vaults', docs: 'Docs', terms: 'Terms', privacy: 'Privacy' };

export default function App() {
  const route = useRoute();
  const { theme, toggle } = useTheme();
  const motion = useMotion();

  useEffect(() => {
    document.title = `Stock Chain · ${TITLES[route.page] || 'Not found'}`;
    if (route.anchor) {
      requestAnimationFrame(() => document.getElementById(route.anchor)?.scrollIntoView({ behavior: motion.reduced ? 'auto' : 'smooth' }));
    } else {
      window.scrollTo(0, 0);
    }
  }, [route.page, route.param, route.anchor, motion.reduced]);

  let page;
  switch (route.page) {
    case 'home': page = <Home reduced={motion.reduced} />; break;
    case 'markets': page = <Markets />; break;
    case 'trade': page = <Trade symbol={route.param?.toUpperCase()} />; break;
    case 'vaults': page = <Vaults />; break;
    case 'docs': page = <Docs section={route.param} />; break;
    case 'terms': case 'privacy': page = <Legal kind={route.page} />; break;
    default: page = <NotFound />;
  }

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <Navbar route={route} theme={theme} onToggleTheme={toggle} />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<div className="page-loading" aria-live="polite">Loading…</div>}>{page}</Suspense>
      </main>
      <Footer reduced={motion.reduced} onToggleMotion={motion.toggle} />
      <WalletModal />
    </>
  );
}
