import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

const contractsDir = path.resolve('contracts');
const files = [
  'GetStockRouter.sol',
  'StonkOracle.sol',
  'StonkDrawdownRetire.sol',
  'StonkFeeRouter.sol',
  'StonkPosition.sol',
  'StonkWell.sol',
  'StonkCreditLine.sol',
  'DeStocks.sol',
];

const sources = {};
for (const file of files) {
  sources[file] = { content: fs.readFileSync(path.join(contractsDir, file), 'utf8') };
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'paris',
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
  },
};

console.log('Compiling contracts with solc 0.8.24 (paris, optimizer: 200 runs)...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

let errors = [];
if (output.errors) {
  for (const err of output.errors) {
    if (err.severity === 'error') {
      errors.push(err.formattedMessage);
    } else {
      console.warn(err.formattedMessage);
    }
  }
}

if (errors.length > 0) {
  console.error('Compilation failed with errors:');
  for (const e of errors) console.error(e);
  process.exit(1);
}

console.log('✅ All 7 contracts compiled successfully!');
const compiledDir = path.join(contractsDir, 'compiled');
if (!fs.existsSync(compiledDir)) fs.mkdirSync(compiledDir, { recursive: true });

for (const [file, contractMap] of Object.entries(output.contracts)) {
  for (const [name, data] of Object.entries(contractMap)) {
    const outPath = path.join(compiledDir, `${name}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ abi: data.abi, bytecode: data.evm.bytecode.object }, null, 2));
    console.log(`Saved artifacts: contracts/compiled/${name}.json`);
  }
}
