/**
 * @file index.ts
 * @description Public API for the @callydus/onramp-core package.
 *
 * This file re-exports everything that consumers of this package need.
 * Only symbols exported here are considered part of the public API.
 * Internal implementation details that are not re-exported here are subject
 * to change without notice.
 *
 * ## Usage
 * ```ts
 * import {
 *   createOnrampClient,
 *   OnrampClient,
 *   usdToLamports,
 *   lamportsToUSD,
 *   LAMPORTS_PER_SOL,
 *   OnrampError,
 *   OracleError,
 *   PriceUnavailableError,
 *   FeeCollectionError,
 *   NotImplementedError,
 *   ValidationError,
 * } from '@callydus/onramp-core';
 * ```
 */

// Types and interfaces
export type {
  Result,
  Network,
  TopupParams,
  TopupResult,
  OnrampAdapter,
  PriceOracleAdapter,
  FeeParams,
  OnrampClientConfig,
  Connection,
  PublicKey,
  TransactionSignature,
} from './types.js';

// Client
export { OnrampClient, createOnrampClient } from './client.js';

// Fee utilities
export { usdToLamports, lamportsToUSD, usdToSOL, LAMPORTS_PER_SOL } from './fee.js';

// Errors
export {
  OnrampError,
  OracleError,
  PriceUnavailableError,
  FeeCollectionError,
  NotImplementedError,
  ValidationError,
} from './errors.js';
