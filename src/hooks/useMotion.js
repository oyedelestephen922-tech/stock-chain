import { useCallback, useEffect, useState } from 'react';

/**
 * Motion preference: follows the OS `prefers-reduced-motion` setting,
 * and the user can override it with the in-app toggle (footer).
 */
export function useMotion() {
  const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const [override, setOverride] = useState(() => { try { return localStorage.getItem('sc-motion'); } catch { return null; } });
  const [osReduced, setOsReduced] = useState(media?.matches ?? false);

  useEffect(() => {
    if (!media) return;
    const fn = (e) => setOsReduced(e.matches);
    media.addEventListener('change', fn);
    return () => media.removeEventListener('change', fn);
  }, [media]);

  const reduced = override ? override === 'reduced' : osReduced;
  useEffect(() => { document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'; }, [reduced]);

  const toggle = useCallback(() => {
    const next = reduced ? 'full' : 'reduced';
    setOverride(next);
    try { localStorage.setItem('sc-motion', next); } catch {}
  }, [reduced]);

  return { reduced, toggle };
}
