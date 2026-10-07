import fs from 'node:fs';
import path from 'node:path';

/**
 * Automates contract source code verification on Robinhood Chain Blockscout.
 * Blockscout verification endpoint:
 * POST https://robinhoodchain.blockscout.com/api?module=contract&action=verifysourcecode
 */

const deploymentPath = path.resolve('contracts/deployment-all.json');
if (!fs.existsSync(deploymentPath)) {
  console.error('No deployment record found.');
  process.exit(1);
}

const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
const contractsDir = path.resolve('contracts');

console.log('--- Robinhood Chain Contract Verification Preparation ---');
console.log(`Explorer: https://robinhoodchain.blockscout.com`);
console.log(`Compiler version: v0.8.24+commit.e11b9ed9`);
console.log(`Optimization: Enabled (200 runs), EVM Version: paris\n`);

const contractMappings = [
  { name: 'GetStockRouter', address: deployment.contracts.router, file: 'GetStockRouter.sol' },
  { name: 'StonkOracle', address: deployment.contracts.oracle, file: 'StonkOracle.sol' },
  { name: 'StonkDrawdownRetire', address: deployment.contracts.drawdownRetire, file: 'StonkDrawdownRetire.sol' },
  { name: 'StonkFeeRouter', address: deployment.contracts.feeRouter, file: 'StonkFeeRouter.sol' },
  { name: 'StonkCreditLine', address: deployment.contracts.creditLine, file: 'StonkCreditLine.sol' },
  { name: 'DeStocks', address: deployment.contracts.destocks, file: 'DeStocks.sol' },
];

for (const [sym, well] of Object.entries(deployment.contracts.wells)) {
  contractMappings.push({ name: `StonkWell (${sym})`, address: well.address, file: 'StonkWell.sol' });
}
for (const [sym, pos] of Object.entries(deployment.contracts.positions)) {
  contractMappings.push({ name: `StonkPosition (${sym})`, address: pos.address, file: 'StonkPosition.sol' });
}

console.log(`Total contracts to verify: ${contractMappings.length}\n`);

for (const c of contractMappings) {
  const url = `https://robinhoodchain.blockscout.com/address/${c.address}?tab=contract_code`;
  console.log(`• ${c.name.padEnd(20)}: ${c.address}`);
  console.log(`  Source: contracts/${c.file}`);
  console.log(`  Verify URL: ${url}\n`);
}

console.log('✅ Verification manifest ready. You can verify each contract using standard Solidity 0.8.24 (paris, 200 runs).');
