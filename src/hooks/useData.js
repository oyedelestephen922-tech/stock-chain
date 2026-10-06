import { useAsync } from './useAsync';
import { marketProvider } from '../services/marketData';
import { getNetworkStatus } from '../services/rpc';
import { getPlatformStats, getVaults } from '../services/protocol';

export const useMarkets = () => useAsync(() => marketProvider.getMarkets(), [], { intervalMs: marketProvider.source === 'api' ? 15000 : 0 });
export const useHistory = (symbol, range) => useAsync(() => marketProvider.getHistory(symbol, range), [symbol, range]);
export const useNetworkStatus = () => useAsync(() => getNetworkStatus(), [], { intervalMs: 12000 });
export const useVaults = () => useAsync(() => getVaults(), []);
export const usePlatformStats = () => useAsync(() => getPlatformStats(), []);
