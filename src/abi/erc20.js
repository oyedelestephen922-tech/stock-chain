// Minimal ERC-20 ABI fragments (function selectors precomputed so no ABI library is needed).
export const ERC20_SELECTORS = {
  balanceOf: '0x70a08231', // balanceOf(address)
  decimals: '0x313ce567',  // decimals()
  symbol: '0x95d89b41',    // symbol()
  approve: '0x095ea7b3',   // approve(address,uint256)
  allowance: '0xdd62ed3e', // allowance(address,address)
};
