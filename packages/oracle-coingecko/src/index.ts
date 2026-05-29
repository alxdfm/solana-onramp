/**
 * @file index.ts
 * @description Public API for the @callydus/onramp-oracle-coingecko package.
 *
 * ## ⚠️ Development/Testing Only
 *
 * This package uses the CoinGecko free public API. It is subject to rate limiting
 * and is NOT recommended for production. Use `@callydus/onramp-oracle-pyth` in production.
 *
 * ## Usage
 * ```ts
 * import { CoinGeckoOracleAdapter } from '@callydus/onramp-oracle-coingecko';
 *
 * const oracle = new CoinGeckoOracleAdapter();
 * const price = await oracle.getSOLPrice();
 * ```
 */

export { CoinGeckoOracleAdapter } from './adapter.js';
