import { useEffect, useState } from 'react';

/**
 * Tiny hash router: #/markets, #/trade/NVDA, #/docs/fees, #/#how-it-works.
 * Hash routes work on any static host (Vercel, Netlify, IPFS) with no rewrites.
 */
const parse = () => {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, anchor] = raw.split('#');
  const parts = path.split('/').filter(Boolean);
  return { page: parts[0] || 'home', param: parts[1] || null, anchor: anchor || null };
};

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const fn = () => setRoute(parse());
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return route;
}

export const href = (path) => `#${path}`;
