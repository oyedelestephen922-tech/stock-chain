import fs from 'node:fs';
import path from 'node:path';
import { createWalletClient, createPublicClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Load .env manually if needed
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
const KEEPER_KEY = process.env.KEEPER_PRIVATE_KEY;
const isAddress = (v) => typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/i.test(v);
const KEEPER_ADDR = isAddress(process.env.KEEPER_ADDRESS) ? process.env.KEEPER_ADDRESS : null;
const COMMUNITY_TOKEN = isAddress(process.env.COMMUNITY_TOKEN_ADDRESS) ? process.env.COMMUNITY_TOKEN_ADDRESS : '0x0000000000000000000000000000000000000000';

const CANONICAL = {
  usdg: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
  weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  uniswapV3Factory: '0x1f7d7550b1b028f7571e69a784071f0205fd2efa',
  uniswapQuoterV2: '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7',
  equities: [
    { symbol: 'TSLA', name: 'Tesla', address: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d' },
    { symbol: 'NVDA', name: 'NVIDIA', address: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC' },
    { symbol: 'AAPL', name: 'Apple', address: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9' },
    { symbol: 'PLTR', name: 'Palantir', address: '0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A' },
    { symbol: 'META', name: 'Meta', address: '0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35' },
    { symbol: 'GOOGL', name: 'Alphabet', address: '0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3' },
    { symbol: 'SPY', name: 'SPDR S&P 500', address: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C' },
  ],
};

const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
});

async function main() {
  if (!DEPLOYER_KEY) {
    console.error('ERROR: DEPLOYER_PRIVATE_KEY is not set in .env or contracts/.env');
    console.error('Please configure DEPLOYER_PRIVATE_KEY before running deployment.');
    process.exit(1);
  }

  const account = privateKeyToAccount(DEPLOYER_KEY.startsWith('0x') ? DEPLOYER_KEY : `0x${DEPLOYER_KEY}`);
  const keeperAddress = KEEPER_ADDR || (KEEPER_KEY ? privateKeyToAccount(KEEPER_KEY.startsWith('0x') ? KEEPER_KEY : `0x${KEEPER_KEY}`).address : account.address);

  console.log(`--- Starting 19-Contract Deployment on Robinhood Chain (${CHAIN_ID}) ---`);
  console.log(`Deployer: ${account.address}`);
  console.log(`Keeper:   ${keeperAddress}`);

  const publicClient = createPublicClient({ chain: robinhoodChain, transport: http() });
  const walletClient = createWalletClient({ account, chain: robinhoodChain, transport: http() });

  const compiledDir = path.resolve('contracts/compiled');
  const loadArtifact = (name) => JSON.parse(fs.readFileSync(path.join(compiledDir, `${name}.json`), 'utf8'));

  async function deployContract(name, args = []) {
    const artifact = loadArtifact(name);
    console.log(`Deploying ${name}...`);
    const hash = await walletClient.deployContract({
      abi: artifact.abi,
      bytecode: `0x${artifact.bytecode}`,
      args,
    });
    console.log(`  tx sent: ${hash}, waiting receipt...`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  ✅ ${name} deployed at: ${receipt.contractAddress}`);
    return { address: receipt.contractAddress, abi: artifact.abi };
  }

  // 1. Deploy GetStockRouter
  const router = await deployContract('GetStockRouter', [CANONICAL.uniswapV3Factory, CANONICAL.weth]);

  // 2. Deploy StonkOracle
  const oracle = await deployContract('StonkOracle', []);

  // 3. Deploy StonkDrawdownRetire
  const drawdownRetire = await deployContract('StonkDrawdownRetire', [COMMUNITY_TOKEN]);

  // 4. Deploy StonkFeeRouter
  const feeRouter = await deployContract('StonkFeeRouter', [drawdownRetire.address]);

  // 5 & 6. Deploy 7 StonkWells and 7 StonkPositions
  const wells = {};
  const positions = {};

  for (const eq of CANONICAL.equities) {
    console.log(`\n--- Deploying Well & Position for ${eq.symbol} ---`);
    const wellName = `${eq.name} Stonk Well`;
    const wellSymbol = `w${eq.symbol}`;

    const well = await deployContract('StonkWell', [
      wellName,
      wellSymbol,
      eq.address,
      CANONICAL.usdg,
      oracle.address,
      feeRouter.address,
      keeperAddress,
      0n, // 0 = unlimited cap
    ]);

    const position = await deployContract('StonkPosition', [well.address, keeperAddress]);

    console.log(`  Linking Position to Well for ${eq.symbol}...`);
    const linkHash = await walletClient.writeContract({
      address: well.address,
      abi: well.abi,
      functionName: 'setPositionManager',
      args: [position.address],
    });
    await publicClient.waitForTransactionReceipt({ hash: linkHash });
    console.log(`  ✅ Linked position manager.`);

    wells[eq.symbol] = {
      name: wellName,
      symbol: wellSymbol,
      address: well.address,
      equityToken: eq.address,
    };
    positions[eq.symbol] = {
      address: position.address,
    };
  }

  // 7. Deploy StonkCreditLine (using META Well as default collateral)
  console.log(`\n--- Deploying StonkCreditLine (Borrow Desk) ---`);
  const metaWellAddress = wells['META'].address;
  const creditLine = await deployContract('StonkCreditLine', [CANONICAL.usdg, metaWellAddress]);

  // 8. Deploy DeStocks (Options Protocol)
  console.log(`\n--- Deploying DeStocks (Options Protocol) ---`);
  const destocks = await deployContract('DeStocks', [CANONICAL.usdg, feeRouter.address, account.address]);

  const deploymentData = {
    network: {
      chainId: CHAIN_ID,
      name: 'Robinhood Chain',
      rpcUrl: RPC_URL,
    },
    canonical: CANONICAL,
    contracts: {
      router: router.address,
      oracle: oracle.address,
      drawdownRetire: drawdownRetire.address,
      feeRouter: feeRouter.address,
      creditLine: creditLine.address,
      destocks: destocks.address,
      wells,
      positions,
    },
    deployedAt: new Date().toISOString(),
  };

  const outFile = path.resolve('contracts/deployment-all.json');
  fs.writeFileSync(outFile, JSON.stringify(deploymentData, null, 2));
  console.log(`\n🎉 Full 20-contract ecosystem deployed successfully! Saved to: ${outFile}`);

  // Automatically update src/config/contracts.js
  const contractsConfigPath = path.resolve('src/config/contracts.js');
  const contractsConfigContent = `// Auto-generated by contracts/deploy-all.mjs
export const CONTRACTS = {
  router: '${router.address}',
  oracle: '${oracle.address}',
  drawdownRetire: '${drawdownRetire.address}',
  feeRouter: '${feeRouter.address}',
  creditLine: '${creditLine.address}',
  destocks: '${destocks.address}',
  swapRouter02: '0xCaf681a66D020601342297493863E78C959E5cb2',
  ponsFactory: '0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB',
};

export const WELLS = ${JSON.stringify(wells, null, 2)};

export const hasTradingContracts = Boolean(CONTRACTS.router || CONTRACTS.destocks);
`;
  fs.writeFileSync(contractsConfigPath, contractsConfigContent);
  console.log(`Updated frontend config: ${contractsConfigPath}`);
}

main().catch((err) => {
  console.error('Deployment error:', err);
  process.exit(1);
});
