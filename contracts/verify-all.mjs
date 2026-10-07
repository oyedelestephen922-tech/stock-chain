import fs from 'node:fs';
import path from 'node:path';

const deploymentPath = path.resolve('contracts/deployment-all.json');
if (!fs.existsSync(deploymentPath)) {
  console.error('No deployment record found.');
  process.exit(1);
}

const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
const CHAIN_ID = '4663';
const COMPILER_VERSION = '0.8.24+commit.e11b9ed9';

const contractsToVerify = [
  { name: 'GetStockRouter', address: deployment.contracts.router, file: 'GetStockRouter.sol', contractName: 'GetStockRouter' },
  { name: 'StonkOracle', address: deployment.contracts.oracle, file: 'StonkOracle.sol', contractName: 'StonkOracle' },
  { name: 'StonkDrawdownRetire', address: deployment.contracts.drawdownRetire, file: 'StonkDrawdownRetire.sol', contractName: 'StonkDrawdownRetire' },
  { name: 'StonkFeeRouter', address: deployment.contracts.feeRouter, file: 'StonkFeeRouter.sol', contractName: 'StonkFeeRouter' },
  { name: 'StonkCreditLine', address: deployment.contracts.creditLine, file: 'StonkCreditLine.sol', contractName: 'StonkCreditLine' },
  { name: 'DeStocks', address: deployment.contracts.destocks, file: 'DeStocks.sol', contractName: 'DeStocks' },
];

for (const [sym, well] of Object.entries(deployment.contracts.wells)) {
  contractsToVerify.push({ name: `StonkWell (${sym})`, address: well.address, file: 'StonkWell.sol', contractName: 'StonkWell' });
}
for (const [sym, pos] of Object.entries(deployment.contracts.positions)) {
  contractsToVerify.push({ name: `StonkPosition (${sym})`, address: pos.address, file: 'StonkPosition.sol', contractName: 'StonkPosition' });
}

console.log(`Starting Sourcify & Blockscout Verification for all ${contractsToVerify.length} contracts on Robinhood Chain (${CHAIN_ID})...\n`);

async function verifyContract(item) {
  const filePath = path.join('contracts', item.file);
  const sourceContent = fs.readFileSync(filePath, 'utf8');

  const body = {
    stdJsonInput: {
      language: 'Solidity',
      sources: {
        [`contracts/${item.file}`]: { content: sourceContent },
      },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        evmVersion: 'paris',
      },
    },
    compilerVersion: COMPILER_VERSION,
    contractIdentifier: `contracts/${item.file}:${item.contractName}`,
  };

  try {
    const res = await fetch(`https://sourcify.dev/server/v2/verify/${CHAIN_ID}/${item.address}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'StockChainDeployer/1.0.0',
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!json.verificationId) {
      if (json.message?.includes('already verified') || json.customCode === 'already_verified') {
        console.log(`✅ ${item.name.padEnd(22)} (${item.address}): Already Verified`);
        return true;
      }
      console.warn(`⚠️ ${item.name} submission notice:`, json);
      return false;
    }

    // Poll for verification completion
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`https://sourcify.dev/server/v2/verify/${json.verificationId}`, {
        headers: { 'User-Agent': 'StockChainDeployer/1.0.0' },
      });
      const statusJson = await statusRes.json();
      if (statusJson.contract?.match) {
        console.log(`✅ ${item.name.padEnd(22)} (${item.address}): Verified (${statusJson.contract.match})`);
        return true;
      }
    }
    console.log(`⏳ ${item.name.padEnd(22)} (${item.address}): Queued for indexing`);
    return true;
  } catch (err) {
    console.error(`❌ ${item.name} failed:`, err.message);
    return false;
  }
}

async function main() {
  for (const item of contractsToVerify) {
    await verifyContract(item);
  }
  console.log('\n🎉 Verification process finished for all contracts on Robinhood Chain!');
}

main();
