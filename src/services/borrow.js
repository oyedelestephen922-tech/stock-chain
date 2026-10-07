import { encodeFunctionData, parseAbi } from 'viem';
import { CONTRACTS, WELLS } from '../config/contracts';
import { CANONICAL_TOKENS } from '../config/tokens';
import { ERC20_SELECTORS } from '../abi/erc20';
import creditLineAbi from '../abi/StonkCreditLine.json';
import { waitForReceipt } from './trade';

function padAddress(addr) {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0');
}

function padUint256(val) {
  return BigInt(val).toString(16).padStart(64, '0');
}

/**
 * Reads user's on-chain borrow position, collateral value, and credit desk liquidity.
 */
export async function getBorrowData(provider, account) {
  if (!CONTRACTS.creditLine || !provider) return null;

  try {
    const metaWell = WELLS.META?.address;
    const usdg = CANONICAL_TOKENS.USDG?.address;

    const creditAbi = parseAbi([
      'function positions(address) view returns (uint256 pledgedShares, uint256 principal, uint256 lastAccruedAt)',
      'function getCollateralValue(address) view returns (uint256)',
      'function getCurrentDebt(address) view returns (uint256)',
    ]);

    const erc20Abi = parseAbi([
      'function balanceOf(address) view returns (uint256)',
      'function convertToAssets(uint256) view returns (uint256)',
    ]);

    let pledgedShares = 0;
    let currentDebt = 0;
    let collateralValue = 0;

    if (account) {
      // 1. User Position
      const posData = encodeFunctionData({
        abi: creditAbi,
        functionName: 'positions',
        args: [account],
      });
      const posHex = await provider.request({
        method: 'eth_call',
        params: [{ to: CONTRACTS.creditLine, data: posData }, 'latest'],
      });
      if (posHex && posHex !== '0x') {
        const rawShares = BigInt('0x' + posHex.slice(2, 66) || '0');
        pledgedShares = Number(rawShares) / 1e18;
      }

      // 2. Collateral Value in USDG (6 decimals)
      const valData = encodeFunctionData({
        abi: creditAbi,
        functionName: 'getCollateralValue',
        args: [account],
      });
      const valHex = await provider.request({
        method: 'eth_call',
        params: [{ to: CONTRACTS.creditLine, data: valData }, 'latest'],
      });
      if (valHex && valHex !== '0x') {
        collateralValue = Number(BigInt(valHex || '0')) / 1e6;
      }

      // 3. Current Debt in USDG (6 decimals)
      const debtData = encodeFunctionData({
        abi: creditAbi,
        functionName: 'getCurrentDebt',
        args: [account],
      });
      const debtHex = await provider.request({
        method: 'eth_call',
        params: [{ to: CONTRACTS.creditLine, data: debtData }, 'latest'],
      });
      if (debtHex && debtHex !== '0x') {
        currentDebt = Number(BigInt(debtHex || '0')) / 1e6;
      }
    }

    // 4. Available Desk Liquidity (USDG in CreditLine contract)
    let deskLiquidityUSDG = 0;
    if (usdg) {
      const deskBalData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [CONTRACTS.creditLine],
      });
      const deskBalHex = await provider.request({
        method: 'eth_call',
        params: [{ to: usdg, data: deskBalData }, 'latest'],
      });
      if (deskBalHex && deskBalHex !== '0x') {
        deskLiquidityUSDG = Number(BigInt(deskBalHex || '0')) / 1e6;
      }
    }

    // 5. Share price estimate for wMETA
    let sharePriceUSD = 560;
    if (metaWell) {
      try {
        const priceData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'convertToAssets',
          args: [1000000000000000000n], // 1 share
        });
        const priceHex = await provider.request({
          method: 'eth_call',
          params: [{ to: metaWell, data: priceData }, 'latest'],
        });
        if (priceHex && priceHex !== '0x') {
          const rawPrice = Number(BigInt(priceHex || '0')) / 1e6;
          if (rawPrice > 0) sharePriceUSD = rawPrice;
        }
      } catch {}
    }

    const maxBorrowLimit = collateralValue * 0.65; // 65% LTV

    return {
      pledgedShares,
      currentDebt,
      collateralValue: collateralValue || pledgedShares * sharePriceUSD,
      maxBorrowLimit,
      sharePriceUSD,
      deskLiquidityUSDG,
    };
  } catch (err) {
    console.error('Error fetching borrow data:', err);
    return null;
  }
}

/**
 * Pledges wMETA shares as borrow collateral.
 */
export async function pledgeCollateral({ shares, account, provider, onStatus }) {
  if (!CONTRACTS.creditLine) throw new Error('Borrow contract not connected.');
  const metaWell = WELLS.META?.address;
  if (!metaWell) throw new Error('wMETA well contract not found.');

  const sharesRaw = BigInt(Math.floor(Number(shares) * 1e18));
  if (sharesRaw <= 0n) throw new Error('Enter a valid shares amount.');

  onStatus?.('Checking wMETA collateral allowance…');
  const allowanceData = `${ERC20_SELECTORS.allowance}${padAddress(account)}${padAddress(CONTRACTS.creditLine)}`;
  const allowanceHex = await provider.request({
    method: 'eth_call',
    params: [{ to: metaWell, data: allowanceData }, 'latest'],
  });
  const currentAllowance = BigInt(allowanceHex || '0x0');

  let approvalHash = null;
  if (currentAllowance < sharesRaw) {
    onStatus?.(`Requesting exact approval of ${shares} wMETA shares…`);
    const approveData = `${ERC20_SELECTORS.approve}${padAddress(CONTRACTS.creditLine)}${padUint256(sharesRaw)}`;
    approvalHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: account, to: metaWell, data: approveData }],
    });
    console.log('[Borrow] Collateral approval submitted:', approvalHash);
    onStatus?.('Waiting for approval confirmation…');
    await waitForReceipt(provider, approvalHash);
  }

  onStatus?.(`Pledging ${shares} wMETA collateral…`);
  const pledgeCalldata = encodeFunctionData({
    abi: creditLineAbi,
    functionName: 'pledgeCollateral',
    args: [sharesRaw],
  });

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from: account, to: CONTRACTS.creditLine, data: pledgeCalldata }],
  });

  return { success: true, hash: txHash, approvalHash };
}

/**
 * Borrows USDG credit against pledged collateral.
 */
export async function borrowUSDG({ amount, account, provider, onStatus }) {
  if (!CONTRACTS.creditLine) throw new Error('Borrow contract not connected.');
  const amountRaw = BigInt(Math.floor(Number(amount) * 1e6));
  if (amountRaw <= 0n) throw new Error('Enter a valid USDG credit amount.');

  onStatus?.(`Confirming borrow of ${amount} USDG in your wallet…`);
  const borrowCalldata = encodeFunctionData({
    abi: creditLineAbi,
    functionName: 'borrow',
    args: [amountRaw],
  });

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from: account, to: CONTRACTS.creditLine, data: borrowCalldata }],
  });

  return { success: true, hash: txHash };
}

/**
 * Repays outstanding USDG credit.
 */
export async function repayUSDG({ amount, account, provider, onStatus }) {
  if (!CONTRACTS.creditLine) throw new Error('Borrow contract not connected.');
  const usdg = CANONICAL_TOKENS.USDG?.address;
  const amountRaw = BigInt(Math.floor(Number(amount) * 1e6));
  if (amountRaw <= 0n) throw new Error('Enter a valid USDG repay amount.');

  onStatus?.('Checking USDG allowance…');
  const allowanceData = `${ERC20_SELECTORS.allowance}${padAddress(account)}${padAddress(CONTRACTS.creditLine)}`;
  const allowanceHex = await provider.request({
    method: 'eth_call',
    params: [{ to: usdg, data: allowanceData }, 'latest'],
  });
  const currentAllowance = BigInt(allowanceHex || '0x0');

  let approvalHash = null;
  if (currentAllowance < amountRaw) {
    onStatus?.(`Requesting exact approval of ${amount} USDG…`);
    const approveData = `${ERC20_SELECTORS.approve}${padAddress(CONTRACTS.creditLine)}${padUint256(amountRaw)}`;
    approvalHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: account, to: usdg, data: approveData }],
    });
    console.log('[Borrow] Repay approval submitted:', approvalHash);
    onStatus?.('Waiting for approval confirmation…');
    await waitForReceipt(provider, approvalHash);
  }

  onStatus?.(`Repaying ${amount} USDG credit…`);
  const repayCalldata = encodeFunctionData({
    abi: creditLineAbi,
    functionName: 'repay',
    args: [amountRaw],
  });

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from: account, to: CONTRACTS.creditLine, data: repayCalldata }],
  });

  return { success: true, hash: txHash, approvalHash };
}

/**
 * Withdraws pledged wMETA collateral.
 */
export async function withdrawCollateral({ shares, account, provider, onStatus }) {
  if (!CONTRACTS.creditLine) throw new Error('Borrow contract not connected.');
  const sharesRaw = BigInt(Math.floor(Number(shares) * 1e18));
  if (sharesRaw <= 0n) throw new Error('Enter a valid shares amount.');

  onStatus?.(`Withdrawing ${shares} wMETA collateral…`);
  const withdrawCalldata = encodeFunctionData({
    abi: creditLineAbi,
    functionName: 'withdrawCollateral',
    args: [sharesRaw],
  });

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from: account, to: CONTRACTS.creditLine, data: withdrawCalldata }],
  });

  return { success: true, hash: txHash };
}
