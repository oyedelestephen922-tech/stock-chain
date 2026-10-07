import fs from 'node:fs';
import path from 'node:path';
import { createWalletClient, createPublicClient, http, defineChain, parseAbi } from 'viem';
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
const KEEPER_KEY = process.env.KEEPER_PRIVATE_KEY;

if (!KEEPER_KEY) {
  console.error('ERROR: KEEPER_PRIVATE_KEY is required to run scripts/keeper.mjs');
  console.error('Please configure KEEPER_PRIVATE_KEY in .env or contracts/.env');
  process.exit(1);
}

const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
});

const deploymentPath = path.resolve('contracts/deployment-all.json');
if (!fs.existsSync(deploymentPath)) {
  console.error(`ERROR: Deployment file not found at ${deploymentPath}`);
  console.error('Run `npm run deploy:all` first.');
  process.exit(1);
}

const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
const account = privateKeyToAccount(KEEPER_KEY.startsWith('0x') ? KEEPER_KEY : `0x${KEEPER_KEY}`);

const publicClient = createPublicClient({ chain: robinhoodChain, transport: http() });
const walletClient = createWalletClient({ account, chain: robinhoodChain, transport: http() });

const wellAbi = parseAbi([
  'function rebalance(int24 newTickLower, int24 newTickUpper) external',
  'function harvest() external returns (uint256 feesCollected)',
  'function totalAssets() external view returns (uint256)',
  'function symbol() external view returns (string)',
]);

console.log(`🤖 StonkWell Autonomous Keeper Bot Initialized`);
console.log(`Keeper Address: ${account.address}`);
console.log(`Target Network: Robinhood Chain (${CHAIN_ID})`);
console.log(`Monitoring ${Object.keys(deployment.contracts.wells).length} Wells...\n`);

async function runKeeperCycle() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] --- Running Keeper Cycle ---`);

  for (const [symbol, wellData] of Object.entries(deployment.contracts.wells)) {
    try {
      console.log(`Checking ${symbol} (${wellData.address})...`);

      // 1. Check & execute harvest
      console.log(`  Executing harvest on ${symbol}...`);
      const harvestTx = await walletClient.writeContract({
        address: wellData.address,
        abi: wellAbi,
        functionName: 'harvest',
        args: [],
      });
      console.log(`  Harvest tx: ${harvestTx}`);
      await publicClient.waitForTransactionReceipt({ hash: harvestTx });
      console.log(`  ✅ Harvest completed for ${symbol}`);

    } catch (err) {
      console.warn(`  ⚠️ Cycle note for ${symbol}: ${err.shortMessage || err.message}`);
    }
  }

  console.log(`[${timestamp}] Cycle complete. Waiting 60 seconds...\n`);
}

// Main execution loop
runKeeperCycle();
setInterval(runKeeperCycle, 60_000);
