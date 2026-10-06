import { useId } from 'react';

/**
 * Stock Chain mark: two interlocking angular chain links that together form an "S".
 * The opposing corner tips trace the trajectory of a rising market.
 */
export function LogoMark({ size = 36, animated = true, title = 'Stock Chain' }) {
  const id = useId().replace(/:/g, '');
  const bg = 'var(--bg)';
  return (
    <svg className={`logo-mark${animated ? ' is-animated' : ''}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
      <defs>
        <linearGradient id={`g${id}`} gradientUnits="userSpaceOnUse" x1="8" y1="4" x2="56" y2="60">
          <stop offset="0" stopColor="#FBE7A8" />
          <stop offset=".45" stopColor="#E2B54A" />
          <stop offset=".75" stopColor="#A9792A" />
          <stop offset="1" stopColor="#F3D27C" />
        </linearGradient>
        <linearGradient id={`s${id}`} gradientUnits="userSpaceOnUse" x1="-40" y1="0" x2="-10" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
          {animated && <animateTransform attributeName="gradientTransform" type="translate" values="0 0; 130 0; 130 0" keyTimes="0; .35; 1" dur="7s" repeatCount="indefinite" />}
        </linearGradient>
        <g id={`m${id}`} fill="none" strokeWidth="5" strokeLinejoin="miter">
          <path d="M47 15 L41 9 L19 9 L12 16 L12 21 L19 28 L45 28 L45 42" />
          <path d="M19 22 L19 36 L45 36 L52 43 L52 48 L45 55 L23 55 L17 49" />
        </g>
      </defs>
      {[`g${id}`, `s${id}`].map((paint, i) => (
        <g key={paint} className={i ? 'logo-sweep' : undefined} style={i ? { mixBlendMode: 'overlay' } : undefined}>
          <use href={`#m${id}`} stroke={`url(#${paint})`} />
          <path d="M45 31 L45 40" stroke={i ? 'none' : bg} strokeWidth="8" />
          <path d="M45 30 L45 42" stroke={`url(#${paint})`} strokeWidth="5" />
          <path d="M19 24 L19 33" stroke={i ? 'none' : bg} strokeWidth="8" />
          <path d="M19 22 L19 34" stroke={`url(#${paint})`} strokeWidth="5" />
          <path d="M47 4 L55 4 L55 12 Z" fill={`url(#${paint})`} />
          <path d="M17 60 L9 60 L9 52 Z" fill={`url(#${paint})`} />
        </g>
      ))}
    </svg>
  );
}

export function Logo({ size = 34 }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-word">Stock Chain</span>
    </span>
  );
}
