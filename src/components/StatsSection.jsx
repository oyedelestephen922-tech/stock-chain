import { useEffect, useRef, useState } from 'react';
import { usePlatformStats } from '../hooks/useData';
import { fmtCompactUsd } from '../utils/format';

function CountUp({ value, format }) {
  const [n, setN] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (value == null || done.current) return;
    if (document.documentElement.dataset.motion === 'reduced') { setN(value); return; }
    done.current = true;
    const start = performance.now();
    let raf;
    const tick = (t) => { const p = Math.min(1, (t - start) / 1200); setN(value * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return value == null ? '--' : format(n);
}

/** Platform metrics. Only real backend values are shown; otherwise "--". */
export function StatsSection() {
  const { data } = usePlatformStats();
  const stats = [
    { label: 'Markets', value: data?.markets, format: (n) => Math.round(n).toString() },
    { label: 'On-chain volume', value: data?.volume, format: fmtCompactUsd },
    { label: 'Total value locked', value: data?.tvl, format: fmtCompactUsd },
    { label: 'Active users', value: data?.users, format: (n) => Math.round(n).toLocaleString() },
  ];
  return (
    <section className="stats" aria-label="Platform metrics">
      <div className="wrap stats-inner">
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <span className="stat-value tabular"><CountUp value={s.value} format={s.format} /></span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>
      {data?.source !== 'api' && <p className="wrap stats-note">Metrics appear once the protocol backend is connected.</p>}
    </section>
  );
}
