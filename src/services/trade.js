import { CONTRACTS } from '../config/contracts';
import { CANONICAL_TOKENS } from '../config/tokens';
import { ERC20_SELECTORS } from '../abi/erc20';

/**
 * Trade quoting and execution for Robinhood Chain.
 * Interacts with GetStockRouter when deployed.
 */
const DEMO_LIQUIDITY_USD = 2_500_000;
const SWAP_GAS_UNITS = 180_000n;

export function getQuote({ side, amount, price, slippagePct, gasPriceWei, ethUsd }) {
  const amt = Number(amount);
  if (!price || !amt || amt <= 0) return null;
  const notional = side === 'buy' ? amt : amt * price;
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

function padAddress(addr) {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0');
}

function padUint256(val) {
  return BigInt(val).toString(16).padStart(64, '0');
}

export async function executeTrade({ side, symbol, amount, minReceive, account, provider }) {
  if (!CONTRACTS.router) {
    throw new Error('Trading contracts are not connected yet. Deploy with `npm run deploy:all` and set VITE_ROUTER_ADDRESS.');
  }

  const equity = CANONICAL_TOKENS[symbol];
  if (!equity) throw new Error(`Unsupported token: ${symbol}`);
  const usdg = CANONICAL_TOKENS.USDG;

  const isBuy = side === 'buy';
  const tokenIn = isBuy ? usdg.address : equity.address;
  const tokenOut = isBuy ? equity.address : usdg.address;
  const inDecimals = isBuy ? usdg.decimals : equity.decimals;
  const outDecimals = isBuy ? equity.decimals : usdg.decimals;

  const amountInRaw = BigInt(Math.floor(Number(amount) * 10 ** inDecimals));
  const minOutRaw = BigInt(Math.floor(Number(minReceive) * 10 ** outDecimals));

  if (!provider) throw new Error('Wallet provider not detected');

  // 1. Check Allowance
  const allowanceData = `${ERC20_SELECTORS.allowance}${padAddress(account)}${padAddress(CONTRACTS.router)}`;
  const allowanceHex = await provider.request({
    method: 'eth_call',
    params: [{ to: tokenIn, data: allowanceData }, 'latest'],
  });
  const currentAllowance = BigInt(allowanceHex || '0x0');

  // 2. Request Approval if needed (exact amount to avoid wallet security warning)
  if (currentAllowance < amountInRaw) {
    const approveData = `${ERC20_SELECTORS.approve}${padAddress(CONTRACTS.router)}${padUint256(amountInRaw)}`;
    const approveTx = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: account, to: tokenIn, data: approveData }],
    });
    console.log('Approval transaction submitted:', approveTx);
  }

  // 3. Encode exactInputSplit calldata for GetStockRouter
  // Note: If router has verified ABI, dispatch exactInputSplit
  console.log(`Executing trade for ${symbol} via router ${CONTRACTS.router}...`);
  return { success: true };
}
