import fs from 'node:fs';
import path from 'node:path';
import { createWalletClient, createPublicClient, http, defineChain, parseAbi, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

function loadEnv() {
  const envPath = path.resolve('.env');
  const contractsEnvPath = path.resolve('contracts/.env');
  const target = fs.existsSync(contractsEnvPath) ? contractsEnvPath : fs.existsSync(envPath) ? envPath : null;
  if (!target) return;
  const content = fs.readFileSync(target, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...v] = trimmed.split('=');
    const key = k.trim();
    const val = v.join('=').trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const RPC_URL = process.env.RPC_URL || process.env.VITE_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const CHAIN_ID = Number(process.env.VITE_CHAIN_ID || 4663);
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;

const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const destocksAbi = parseAbi([
  'function marketCount() view returns (uint32)',
  'function addMarket(address token, address feed) external returns (uint32 id)',
  'function markets(uint32) view returns (address token, address feed, bool active)'
]);

const MARKETS = [
  { symbol: 'TSLA', token: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d', feed: '0x19277A6e4f3a4D01D0F478B4C02570d5F21f1585' },
  { symbol: 'NVDA', token: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC', feed: '0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15' },
  { symbol: 'AAPL', token: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9', feed: '0xA8230559b3B17fFF8C1c4E350280D52c6f1a8b11' },
  { symbol: 'PLTR', token: '0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A', feed: '0x24C1645eEBEc320d321d58B241285E64366A0681' },
  { symbol: 'META', token: '0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35', feed: '0x7C38C00C30BEe9378381E7B6135d7283356D71b1' },
  { symbol: 'GOOGL', token: '0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3', feed: '0xF6f373a037c30F0e5010d854385cA89185AE638b' },
  { symbol: 'SPY', token: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C', feed: '0x9815049b16B49a3770DCEFeF9E82f768D3eaDbA8' },
];

async function main() {
  const account = privateKeyToAccount(DEPLOYER_KEY.startsWith('0x') ? DEPLOYER_KEY : `0x${DEPLOYER_KEY}`);
  const publicClient = createPublicClient({ chain: robinhoodChain, transport: http() });
  const walletClient = createWalletClient({ account, chain: robinhoodChain, transport: http() });
  const destocksAddress = '0xd826711de519ae96459557f19c9fa47faf727ed3';

  const currentCount = await publicClient.readContract({
    address: destocksAddress,
    abi: destocksAbi,
    functionName: 'marketCount',
  });
  console.log(`Current DeStocks market count: ${currentCount}`);

  if (currentCount >= MARKETS.length) {
    console.log('Markets already configured.');
    return;
  }

  for (let i = currentCount; i < MARKETS.length; i++) {
    const m = MARKETS[i];
    console.log(`Adding market for ${m.symbol} (${m.token})...`);
    const tx = await walletClient.writeContract({
      address: destocksAddress,
      abi: destocksAbi,
      functionName: 'addMarket',
      args: [getAddress(m.token), getAddress(m.feed)],
    });
    console.log(`  tx sent: ${tx}, waiting for confirmation...`);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log(`  ✅ Market ${i + 1} added: ${m.symbol}`);
  }
}

main().catch(console.error);
