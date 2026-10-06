# Stock Chain

On-chain stock trading interface for Robinhood Chain (chain ID 4663).
React + Vite, no Web3 libraries: wallets connect through the standard EIP-1193 interface.

## Run locally

```bash
npm install
cp .env.example .env     # Windows: copy .env.example .env
npm run dev              # open http://localhost:5173
```

## Deploy to Vercel

Push this folder to GitHub, then "Add New Project" in Vercel and import it.
Vercel detects Vite automatically. Add the variables from `.env.example`
under Project Settings → Environment Variables.

## What is real vs demo

| Feature | Status |
|---|---|
| Wallet connect / disconnect, address, ETH balance | Real |
| Wrong-network detection + switch/add Robinhood Chain | Real |
| Block height, gas price, network fee estimate | Real (RPC) |
| Wallet transaction history | Real (Blockscout API) |
| Stock prices, charts, ticker | Demo until `VITE_MARKET_API_URL` is set |
| Vault TVL / APY / performance | Demo until `VITE_PROTOCOL_API_URL` is set |
| Platform stats | Shows "--" until the protocol API is set |
| Trade execution, vault deposits | Disabled until contracts are deployed |

Every demo value carries a visible "Demo" badge.

## Where to plug things in

- Prices: `src/services/marketData.js` (expected JSON shape documented at the top)
- Vaults and stats: `src/services/protocol.js`
- Trades: `src/services/trade.js` → `executeTrade()`, plus the ABI in `src/abi/`
- Contract addresses: `.env` only, never in code
- Network: `src/config/network.js` (reads `.env`)

## Project structure

```
src/
  abi/         contract ABIs (add verified ones here)
  components/  UI pieces (Navbar, Hero, MarketCore, TradingTerminal, ...)
  config/      network, contracts, site settings from .env
  hooks/       wallet, data loading, theme, motion, routing
  lib/         wallet (EIP-1193 / EIP-6963)
  pages/       Home, Markets, Trade, Vaults, Docs, Legal, NotFound
  services/    all API / RPC / explorer calls
  styles/      tokens.css (colors, fonts) + global.css
  utils/       formatting helpers
```

## Safety rules baked in

No private keys or seed phrases are ever requested or stored. No contract
addresses, oracle feeds or prices are invented. `VITE_` variables are visible
in the browser, so never put secret API keys in them.
