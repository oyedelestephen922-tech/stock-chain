export const shortAddress = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

export const fmtUsd = (n, digits = 2) =>
  n == null || Number.isNaN(n)
    ? '--'
    : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtPct = (n, digits = 2) =>
  n == null || Number.isNaN(n) ? '--' : `${n >= 0 ? '+' : ''}${Number(n).toFixed(digits)}%`;

export const fmtNum = (n, digits = 4) =>
  n == null || Number.isNaN(n) ? '--' : Number(n).toLocaleString('en-US', { maximumFractionDigits: digits });

export const fmtCompactUsd = (n) =>
  n == null ? '--' : '$' + Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);

export const weiHexToEth = (hex) => {
  if (!hex) return null;
  const wei = BigInt(hex);
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 6);
  return Number(`${whole}.${frac}`);
};

export const timeAgo = (iso) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};
