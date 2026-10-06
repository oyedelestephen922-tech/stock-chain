import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtUsd } from '../utils/format';

/** Interactive SVG price chart (line or candles) with a pointer/touch crosshair. */
export function PriceChart({ candles = [], mode = 'line', height = 360 }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const pad = { t: 16, r: 64, b: 28, l: 8 };
  const geo = useMemo(() => {
    if (!candles.length) return null;
    const lo = Math.min(...candles.map((c) => c.l)), hi = Math.max(...candles.map((c) => c.h));
    const span = hi - lo || 1;
    const iw = width - pad.l - pad.r, ih = height - pad.t - pad.b;
    const x = (i) => pad.l + (i + 0.5) * (iw / candles.length);
    const y = (v) => pad.t + (1 - (v - lo) / span) * ih;
    const ticks = Array.from({ length: 5 }, (_, i) => lo + (span * i) / 4);
    return { x, y, ticks, iw, ih, bw: Math.max(1.5, (iw / candles.length) * 0.62) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, width, height]);

  if (!geo) return <div ref={wrapRef} className="chart-empty" style={{ height }}>No price history available.</div>;

  const first = candles[0].o, last = candles[candles.length - 1].c;
  const up = last >= first;
  const color = up ? 'var(--up)' : 'var(--down)';
  const line = candles.map((c, i) => `${i ? 'L' : 'M'}${geo.x(i).toFixed(1)} ${geo.y(c.c).toFixed(1)}`).join(' ');

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.touches?.[0]?.clientX ?? e.clientX) - r.left;
    const i = Math.round(((px - pad.l) / geo.iw) * candles.length - 0.5);
    setHover(Math.max(0, Math.min(candles.length - 1, i)));
  };
  const h = hover != null ? candles[hover] : null;

  return (
    <div ref={wrapRef} className="chart" style={{ height }}>
      <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onTouchMove={onMove} role="img" aria-label={`Price chart, last ${fmtUsd(last)}`}>
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={up ? 'var(--up)' : 'var(--down)'} stopOpacity=".22" />
            <stop offset="1" stopColor={up ? 'var(--up)' : 'var(--down)'} stopOpacity="0" />
          </linearGradient>
        </defs>
        {geo.ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={width - pad.r} y1={geo.y(v)} y2={geo.y(v)} className="chart-grid" />
            <text x={width - pad.r + 8} y={geo.y(v) + 4} className="chart-axis">{v.toFixed(2)}</text>
          </g>
        ))}
        {mode === 'line' ? (
          <>
            <path d={`${line} L${geo.x(candles.length - 1)} ${height - pad.b} L${geo.x(0)} ${height - pad.b} Z`} fill="url(#chartFill)" />
            <path d={line} fill="none" stroke={color} strokeWidth="1.8" className="chart-line" />
          </>
        ) : (
          candles.map((c, i) => {
            const cu = c.c >= c.o;
            return (
              <g key={i} stroke={cu ? 'var(--up)' : 'var(--down)'}>
                <line x1={geo.x(i)} x2={geo.x(i)} y1={geo.y(c.h)} y2={geo.y(c.l)} />
                <rect x={geo.x(i) - geo.bw / 2} y={geo.y(Math.max(c.o, c.c))} width={geo.bw} height={Math.max(1, Math.abs(geo.y(c.o) - geo.y(c.c)))} fill={cu ? 'var(--up)' : 'var(--down)'} fillOpacity={cu ? 0.9 : 0.75} />
              </g>
            );
          })
        )}
        <line x1={pad.l} x2={width - pad.r} y1={geo.y(last)} y2={geo.y(last)} className="chart-last" />
        <rect x={width - pad.r + 2} y={geo.y(last) - 10} width={pad.r - 4} height={20} className="chart-last-tag" />
        <text x={width - pad.r + 8} y={geo.y(last) + 4} className="chart-last-text">{last.toFixed(2)}</text>
        {h && (
          <g className="chart-cross">
            <line x1={geo.x(hover)} x2={geo.x(hover)} y1={pad.t} y2={height - pad.b} />
            <line x1={pad.l} x2={width - pad.r} y1={geo.y(h.c)} y2={geo.y(h.c)} />
            <circle cx={geo.x(hover)} cy={geo.y(h.c)} r="4" fill={color} />
          </g>
        )}
      </svg>
      {h && (
        <div className="chart-tip" style={{ left: Math.min(width - 190, Math.max(8, geo.x(hover) + 12)) }}>
          <span>{new Date(h.t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          <span className="tabular">O {h.o.toFixed(2)} H {h.h.toFixed(2)}</span>
          <span className="tabular">L {h.l.toFixed(2)} C {h.c.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
