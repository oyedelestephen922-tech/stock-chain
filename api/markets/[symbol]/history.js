import { handle } from '../../_lib/quotes.js';

// Vercel serverless function: GET /api/markets/:symbol/history?range=1D
export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  return handle(url.pathname, url.searchParams, res);
}
