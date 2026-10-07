import { encodeFunctionData, parseAbi } from 'viem';
import { CONTRACTS } from '../config/contracts';
import { CANONICAL_TOKENS } from '../config/tokens';
import { ERC20_SELECTORS } from '../abi/erc20';
import routerAbi from '../abi/GetStockRouter.json';

/**
 * Trade quoting and execution for Robinhood Chain.
 * Interacts with GetStockRouter and verified Uniswap V3 pools.
 */
const DEMO_LIQUIDITY_USD = 2_500_000;
const SWAP_GAS_UNITS = 180_000n;

// Verified active pools on Robinhood Chain Mainnet (Chain ID: 4663)
const CANONICAL_POOLS = {
  NVDA: '0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3',
  TSLA: '0xf4ACdAEEB7022862A763C9B1B885e11191c889E3',
  AAPL: '0xAae0d815EE56e4092a5E5C2911E676Fea50B2d6D',
  PLTR: '0x851680416A4f4E1c463d45171d61ACDdBc8554c0',
  META: '0x107a7Cb40d8665360ba10E59471Af06150A50922',
  GOOGL: '0x34D0dC122CF9A8Eb296fC5e0D3A233625D7d19b7',
  SPY: '0xa7Bb1AC63BBaB0C44316E6c8C455213441689167',
};

const UNISWAP_V3_FACTORY = '0x1f7d7550b1b028f7571e69a784071f0205fd2efa';

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

/**
 * Polls for transaction receipt to ensure state has settled before subsequent steps.
 */
export async function waitForReceipt(provider, txHash, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const receipt = await provider.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      });
      if (receipt && receipt.blockNumber) {
        if (receipt.status === '0x0') {
          throw new Error(`Transaction reverted: ${txHash}`);
        }
        return receipt;
      }
    } catch (err) {
      if (err.message?.includes('reverted')) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return null;
}

/**
 * Resolves Uniswap V3 pool address for the given equity and stable token.
 */
async function resolvePoolAddress(provider, symbol, tokenA, tokenB) {
  if (CANONICAL_POOLS[symbol]) {
    return CANONICAL_POOLS[symbol];
  }

  // Dynamic lookup via Uniswap V3 Factory
  const factoryAbi = parseAbi(['function getPool(address,address,uint24) view returns (address)']);
  for (const fee of [500, 3000, 10000]) {
    try {
      const data = encodeFunctionData({
        abi: factoryAbi,
        functionName: 'getPool',
        args: [tokenA, tokenB, fee],
      });
      const res = await provider.request({
        method: 'eth_call',
        params: [{ to: UNISWAP_V3_FACTORY, data }, 'latest'],
      });
      if (res && res !== '0x' && res !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        const pool = `0x${res.slice(26)}`;
        return pool;
      }
    } catch {
      // try next fee tier
    }
  }

  throw new Error(`No Uniswap V3 pool found for ${symbol} on Robinhood Chain.`);
}

export async function executeTrade({ side, symbol, amount, minReceive, account, provider, onStatus }) {
  if (!CONTRACTS.router) {
    throw new Error('Trading contracts are not connected yet. Set VITE_ROUTER_ADDRESS in .env.');
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
  const minOutRaw = BigInt(Math.max(1, Math.floor(Number(minReceive || 0) * 10 ** outDecimals)));

  if (!provider) throw new Error('Wallet provider not detected');

  onStatus?.('Checking token allowance…');

  // 1. Check Allowance
  const allowanceData = `${ERC20_SELECTORS.allowance}${padAddress(account)}${padAddress(CONTRACTS.router)}`;
  const allowanceHex = await provider.request({
    method: 'eth_call',
    params: [{ to: tokenIn, data: allowanceData }, 'latest'],
  });
  const currentAllowance = BigInt(allowanceHex || '0x0');

  let approvalHash = null;

  // 2. Request Approval if needed (exact amount to avoid wallet security warning)
  if (currentAllowance < amountInRaw) {
    onStatus?.(`Requesting exact approval of ${amount} ${isBuy ? 'USDG' : symbol}…`);
    const approveData = `${ERC20_SELECTORS.approve}${padAddress(CONTRACTS.router)}${padUint256(amountInRaw)}`;
    approvalHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: account, to: tokenIn, data: approveData }],
    });
    console.log('[Trade] Approval transaction submitted:', approvalHash);
    onStatus?.('Waiting for approval confirmation…');
    await waitForReceipt(provider, approvalHash);
  }

  // 3. Resolve pool
  onStatus?.('Resolving liquidity pool…');
  const poolAddress = await resolvePoolAddress(provider, symbol, tokenIn, tokenOut);

  // 4. Encode exactInputSplit calldata for GetStockRouter
  onStatus?.('Please confirm swap transaction in your wallet…');
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 min
  const params = {
    tokenIn,
    tokenOut,
    amountInTotal: amountInRaw,
    amountOutMinimum: minOutRaw,
    recipient: account,
    deadline,
    steps: [
      {
        pool: poolAddress,
        tokenIn,
        tokenOut,
        amountIn: amountInRaw,
        sqrtPriceLimitX96: 0n,
      },
    ],
  };

  const swapCalldata = encodeFunctionData({
    abi: routerAbi,
    functionName: 'exactInputSplit',
    args: [params],
  });

  const swapTx = await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: account,
        to: CONTRACTS.router,
        data: swapCalldata,
        value: '0x0',
      },
    ],
  });

  console.log(`[Trade] Swap transaction broadcasted: ${swapTx}`);
  return { success: true, hash: swapTx, approvalHash };
}
