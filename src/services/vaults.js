import { encodeFunctionData, parseAbi } from 'viem';
import { WELLS } from '../config/contracts';
import { CANONICAL_TOKENS } from '../config/tokens';
import { ERC20_SELECTORS } from '../abi/erc20';
import wellAbi from '../abi/StonkWell.json';
import { waitForReceipt } from './trade';

function padAddress(addr) {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0');
}

function padUint256(val) {
  return BigInt(val).toString(16).padStart(64, '0');
}

/**
 * Deposits single-sided USDG into a StonkWell vault.
 */
export async function depositUSDG({ symbol, amount, account, provider, onStatus }) {
  const well = WELLS[symbol];
  if (!well || !well.address) {
    throw new Error(`StonkWell vault for ${symbol} is not configured.`);
  }

  const usdg = CANONICAL_TOKENS.USDG;
  const amountRaw = BigInt(Math.floor(Number(amount) * 10 ** usdg.decimals));
  if (amountRaw <= 0n) throw new Error('Enter an amount greater than zero.');

  if (!provider) throw new Error('Wallet provider not detected.');

  onStatus?.('Checking USDG allowance…');
  const allowanceData = `${ERC20_SELECTORS.allowance}${padAddress(account)}${padAddress(well.address)}`;
  const allowanceHex = await provider.request({
    method: 'eth_call',
    params: [{ to: usdg.address, data: allowanceData }, 'latest'],
  });
  const currentAllowance = BigInt(allowanceHex || '0x0');

  let approvalHash = null;
  if (currentAllowance < amountRaw) {
    onStatus?.(`Requesting exact approval of ${amount} USDG…`);
    const approveData = `${ERC20_SELECTORS.approve}${padAddress(well.address)}${padUint256(amountRaw)}`;
    approvalHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: account, to: usdg.address, data: approveData }],
    });
    console.log('[Vault] Approval submitted:', approvalHash);
    onStatus?.('Waiting for approval confirmation…');
    await waitForReceipt(provider, approvalHash);
  }

  onStatus?.(`Depositing ${amount} USDG into ${well.name}…`);
  const depositCalldata = encodeFunctionData({
    abi: wellAbi,
    functionName: 'deposit',
    args: [amountRaw, account],
  });

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from: account, to: well.address, data: depositCalldata }],
  });

  console.log('[Vault] Deposit submitted:', txHash);
  return { success: true, hash: txHash, approvalHash };
}

/**
 * Redeems StonkWell vault shares in-kind (pro-rata idle USDG + active equity).
 */
export async function redeemInKind({ symbol, shares, account, provider, onStatus }) {
  const well = WELLS[symbol];
  if (!well || !well.address) {
    throw new Error(`StonkWell vault for ${symbol} is not configured.`);
  }

  const sharesRaw = BigInt(Math.floor(Number(shares) * 1e18));
  if (sharesRaw <= 0n) throw new Error('Enter a shares amount greater than zero.');

  if (!provider) throw new Error('Wallet provider not detected.');

  onStatus?.(`Confirming in-kind redemption of ${shares} ${well.symbol}…`);
  const redeemCalldata = encodeFunctionData({
    abi: wellAbi,
    functionName: 'redeemInKind',
    args: [sharesRaw],
  });

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from: account, to: well.address, data: redeemCalldata }],
  });

  console.log('[Vault] In-kind redeem submitted:', txHash);
  return { success: true, hash: txHash };
}

/**
 * Queries user's on-chain shares and USDG value in a StonkWell.
 */
export async function getUserWellPosition(provider, symbol, account) {
  const well = WELLS[symbol];
  if (!well || !well.address || !account || !provider) return null;

  try {
    const erc20BalanceAbi = parseAbi([
      'function balanceOf(address) view returns (uint256)',
      'function convertToAssets(uint256) view returns (uint256)',
    ]);

    const balanceCalldata = encodeFunctionData({
      abi: erc20BalanceAbi,
      functionName: 'balanceOf',
      args: [account],
    });
    const balHex = await provider.request({
      method: 'eth_call',
      params: [{ to: well.address, data: balanceCalldata }, 'latest'],
    });
    const sharesRaw = BigInt(balHex || '0x0');
    if (sharesRaw === 0n) return { shares: 0, usdgValue: 0 };

    const convertCalldata = encodeFunctionData({
      abi: erc20BalanceAbi,
      functionName: 'convertToAssets',
      args: [sharesRaw],
    });
    const valHex = await provider.request({
      method: 'eth_call',
      params: [{ to: well.address, data: convertCalldata }, 'latest'],
    });
    const assetsRaw = BigInt(valHex || '0x0');

    return {
      shares: Number(sharesRaw) / 1e18,
      usdgValue: Number(assetsRaw) / 1e6,
    };
  } catch (err) {
    console.error(`Error querying user well position for ${symbol}:`, err);
    return null;
  }
}
