/**
 * @file index.ts
 * @description Public API for the @callydus/onramp-oracle-pyth package.
 *
 * ## Usage
 * ```ts
 * import { PythOracleAdapter } from '@callydus/onramp-oracle-pyth';
 *
 * const oracle = new PythOracleAdapter({ cluster: 'pythnet' });
 * const price = await oracle.getSOLPrice();
 * ```
 */

export { PythOracleAdapter } from './adapter.js';
export {
  pythAdapterConfigSchema,
  PYTH_SOL_USD_SYMBOL,
  PYTH_SOL_USD_FEED_ID,
  PYTH_SOL_USD_MAINNET_ACCOUNT,
  PYTH_SOL_USD_DEVNET_ACCOUNT,
  PYTH_CLUSTERS,
} from './config.js';
export type { PythAdapterConfig, PythCluster } from './config.js';
