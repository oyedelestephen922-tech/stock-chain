import { CONTRACTS } from '../config/contracts';

/**
 * Trade quoting and execution.
 *
 * getQuote() is a LOCAL ESTIMATE built from whatever price the market service supplies.
 * When the router contract exists, replace it with the router's on-chain quote
 * (e.g. a `quote` / `getAmountsOut` view call) so users see the real executable price.
 */
const DEMO_LIQUIDITY_USD = 2_500_000; // placeholder depth for the price-impact estimate
const SWAP_GAS_UNITS = 180_000n;       // typical swap gas; replace with eth_estimateGas once wired

export function getQuote({ side, amount, price, slippagePct, gasPriceWei, ethUsd }) {
  const amt = Number(amount);
  if (!price || !amt || amt <= 0) return null;
  const notional = side === 'buy' ? amt : amt * price; // buy: amount in USD; sell: amount in shares
  const impactPct = Math.min(15, (notional / DEMO_LIQUIDITY_USD) * 100);
  const execPrice = side === 'buy' ? price * (1 + impactPct / 100) : price * (1 - impactPct / 100);
  const receive = side === 'buy' ? amt / execPrice : amt * execPrice;
  const minReceive = receive * (1 - slippagePct / 100);
  const feeEth = gasPriceWei ? Number(gasPriceWei * SWAP_GAS_UNITS) / 1e18 : null;
  return {
    receive, minReceive, execPrice, impactPct,
    feeEth, feeUsd: feeEth != null && ethUsd ? feeEth * ethUsd : null,
    isEstimate: true,
  };
}

export async function executeTrade() {
  if (!CONTRACTS.router) {
    throw new Error('Trading contracts are not connected yet. Set VITE_ROUTER_ADDRESS once the router is deployed and verified.');
  }
  // Wire the verified router ABI here (see src/abi/README.md):
  // 1. check/request ERC-20 allowance  2. build calldata  3. eth_sendTransaction via the wallet
  throw new Error('Router integration is pending its verified ABI.');
}
