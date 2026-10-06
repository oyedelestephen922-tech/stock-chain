# ABIs

Put the verified ABI JSON for each Stock Chain contract here once it exists
(e.g. `StockChainRouter.json`, `VaultFactory.json`), exported from your
compiler output or from the Blockscout "Code" tab of the verified contract.

The frontend never invents ABIs or addresses. `src/services/trade.js` is where
the router ABI gets wired into `executeTrade()`.
