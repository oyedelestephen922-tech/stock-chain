const env = import.meta.env;

// Social links render only when a real URL is configured.
export const SOCIALS = [
  { key: 'x', label: 'X', url: env.VITE_SOCIAL_X },
  { key: 'discord', label: 'Discord', url: env.VITE_SOCIAL_DISCORD },
  { key: 'telegram', label: 'Telegram', url: env.VITE_SOCIAL_TELEGRAM },
].filter((s) => s.url && /^https?:\/\//.test(s.url));

// Market data: empty = the built-in /api routes (live prices); "demo" = placeholder data.
const marketEnv = (env.VITE_MARKET_API_URL || '').trim();

export const API = {
  market: marketEnv === 'demo' ? '' : (marketEnv || '/api').replace(/\/$/, ''),
  protocol: (env.VITE_PROTOCOL_API_URL || '').replace(/\/$/, ''),
};
