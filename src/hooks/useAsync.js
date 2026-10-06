import { useEffect, useState } from 'react';

/** Runs an async loader and tracks loading / error / data. Re-runs when deps change. */
export function useAsync(loader, deps = [], { intervalMs } = {}) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const run = () =>
      loader({ signal: ctrl.signal })
        .then((data) => alive && setState({ loading: false, error: null, data }))
        .catch((error) => alive && error.name !== 'AbortError' && setState((s) => ({ loading: false, error, data: s.data })));
    run();
    const t = intervalMs ? setInterval(run, intervalMs) : null;
    return () => { alive = false; ctrl.abort(); if (t) clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
