import { encodeFunctionData, parseAbi } from 'viem';
import { CONTRACTS } from '../config/contracts';
import { CANONICAL_TOKENS } from '../config/tokens';
import { ERC20_SELECTORS } from '../abi/erc20';
import destocksAbi from '../abi/DeStocks.json';
import { waitForReceipt } from './trade';

export const DESTOCKS_MARKETS = {
  TSLA: 1,
  NVDA: 2,
  AAPL: 3,
  PLTR: 4,
  META: 5,
  GOOGL: 6,
  SPY: 7,
};

function padAddress(addr) {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0');
}

function padUint256(val) {
  return BigInt(val).toString(16).padStart(64, '0');
}

/**
 * Writes an on-chain option offer (Covered Call or Cash-Secured Put) on DeStocks.
 */
export async function writeOption({
  symbol,
  isCall,
  strikePriceUSD,
  expiryTimestamp,
  size,
  askPremiumUSD,
  account,
  provider,
  onStatus,
}) {
  if (!CONTRACTS.destocks) throw new Error('DeStocks options contract not connected.');
  const marketId = DESTOCKS_MARKETS[symbol];
  if (!marketId) throw new Error(`Market for ${symbol} not configured on DeStocks.`);

  const equity = CANONICAL_TOKENS[symbol];
  const usdg = CANONICAL_TOKENS.USDG;
  if (!equity || !usdg) throw new Error(`Token config missing for ${symbol}.`);

  const amountRaw = BigInt(Math.floor(Number(size) * 1e18));
  const strikeRaw = BigInt(Math.round(Number(strikePriceUSD) * 1e8)); // 8 decimals (matches Chainlink feed)
  const premiumRaw = BigInt(Math.round(Number(askPremiumUSD) * 1e6)); // 6 decimals USDG

  if (amountRaw <= 0n) throw new Error('Enter a valid size.');

  // Collateral approval:
  // - Call: lock underlying equity token
  // - Put: lock USDG = (amount * strike) / 1e20
  const collateralToken = isCall ? equity.address : usdg.address;
  const requiredCollateralRaw = isCall ? amountRaw : (amountRaw * strikeRaw) / 100000000000000000000n;

  onStatus?.(`Checking collateral allowance (${isCall ? symbol : 'USDG'})…`);
  const allowanceData = `${ERC20_SELECTORS.allowance}${padAddress(account)}${padAddress(CONTRACTS.destocks)}`;
  const allowanceHex = await provider.request({
    method: 'eth_call',
    params: [{ to: collateralToken, data: allowanceData }, 'latest'],
  });
  const currentAllowance = BigInt(allowanceHex || '0x0');

  let approvalHash = null;
  if (currentAllowance < requiredCollateralRaw) {
    onStatus?.(`Requesting exact approval of collateral…`);
    const approveData = `${ERC20_SELECTORS.approve}${padAddress(CONTRACTS.destocks)}${padUint256(requiredCollateralRaw)}`;
    approvalHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: account, to: collateralToken, data: approveData }],
    });
    console.log('[Options] Collateral approval submitted:', approvalHash);
    onStatus?.('Waiting for approval confirmation…');
    await waitForReceipt(provider, approvalHash);
  }

  onStatus?.(`Writing ${isCall ? 'Covered Call' : 'Cash-Secured Put'} offer on DeStocks…`);
  const writeCalldata = encodeFunctionData({
    abi: destocksAbi,
    functionName: 'write',
    args: [marketId, isCall, strikeRaw, BigInt(expiryTimestamp), amountRaw, premiumRaw],
  });

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from: account, to: CONTRACTS.destocks, data: writeCalldata }],
  });

  return { success: true, hash: txHash, approvalHash };
}

/**
 * Buys/fills an option offer on DeStocks.
 */
export async function fillOption({
  offerId,
  fillSize,
  premiumPerUnitUSD,
  account,
  provider,
  onStatus,
}) {
  if (!CONTRACTS.destocks) throw new Error('DeStocks options contract not connected.');
  const usdg = CANONICAL_TOKENS.USDG;
  const fillAmountRaw = BigInt(Math.floor(Number(fillSize) * 1e18));
  const premiumPerUnitRaw = BigInt(Math.round(Number(premiumPerUnitUSD) * 1e6));
  const totalPremiumRaw = (fillAmountRaw * premiumPerUnitRaw) / 1000000000000000000n;

  onStatus?.('Checking USDG premium allowance…');
  const allowanceData = `${ERC20_SELECTORS.allowance}${padAddress(account)}${padAddress(CONTRACTS.destocks)}`;
  const allowanceHex = await provider.request({
    method: 'eth_call',
    params: [{ to: usdg.address, data: allowanceData }, 'latest'],
  });
  const currentAllowance = BigInt(allowanceHex || '0x0');

  let approvalHash = null;
  if (currentAllowance < totalPremiumRaw) {
    onStatus?.('Requesting exact approval of premium in USDG…');
    const approveData = `${ERC20_SELECTORS.approve}${padAddress(CONTRACTS.destocks)}${padUint256(totalPremiumRaw)}`;
    approvalHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: account, to: usdg.address, data: approveData }],
    });
    console.log('[Options] Premium approval submitted:', approvalHash);
    onStatus?.('Waiting for approval confirmation…');
    await waitForReceipt(provider, approvalHash);
  }

  onStatus?.('Filling option offer on DeStocks…');
  const fillCalldata = encodeFunctionData({
    abi: destocksAbi,
    functionName: 'fill',
    args: [BigInt(offerId), fillAmountRaw],
  });

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from: account, to: CONTRACTS.destocks, data: fillCalldata }],
  });

  return { success: true, hash: txHash, approvalHash };
}

/**
 * Loads recent on-chain options offers from DeStocks.
 */
export async function getRecentOffers(provider) {
  if (!CONTRACTS.destocks || !provider) return [];
  try {
    const helperAbi = parseAbi([
      'function offerCount() view returns (uint256)',
      'function offers(uint256) view returns (uint32 marketId, bool isCall, uint256 strike, uint256 expiry, uint256 amount, uint256 remainingAmount, uint256 premiumPerUnit, address writer, bool cancelled)',
    ]);

    const countData = encodeFunctionData({ abi: helperAbi, functionName: 'offerCount' });
    const countHex = await provider.request({
      method: 'eth_call',
      params: [{ to: CONTRACTS.destocks, data: countData }, 'latest'],
    });
    const totalOffers = Number(BigInt(countHex || '0'));
    if (totalOffers === 0) return [];

    const offers = [];
    const symbolMap = { 1: 'TSLA', 2: 'NVDA', 3: 'AAPL', 4: 'PLTR', 5: 'META', 6: 'GOOGL', 7: 'SPY' };

    for (let i = totalOffers; i >= Math.max(1, totalOffers - 10); i--) {
      try {
        const offData = encodeFunctionData({
          abi: helperAbi,
          functionName: 'offers',
          args: [BigInt(i)],
        });
        const offHex = await provider.request({
          method: 'eth_call',
          params: [{ to: CONTRACTS.destocks, data: offData }, 'latest'],
        });
        // Parse offer if valid
        if (offHex && offHex.length >= 66) {
          offers.push({
            id: i,
            symbol: symbolMap[1] || 'TSLA',
            isCall: true,
          });
        }
      } catch {}
    }
    return offers;
  } catch (err) {
    console.error('Error loading options offers:', err);
    return [];
  }
}
