/**
 * @file index.ts
 * @description Public API for the @callydus/onramp-adapter-moonpay package.
 *
 * ## Usage
 * ```ts
 * import { MoonPayAdapter } from '@callydus/onramp-adapter-moonpay';
 * import { createOnrampClient } from '@callydus/onramp-core';
 * import { PythOracleAdapter } from '@callydus/onramp-oracle-pyth';
 *
 * const client = createOnrampClient({
 *   onrampAdapter: new MoonPayAdapter({
 *     apiKey: process.env.NEXT_PUBLIC_MOONPAY_API_KEY,
 *     urlSignerEndpoint: '/api/sign-moonpay-url',
 *   }),
 *   oracleAdapter: new PythOracleAdapter({ cluster: 'pythnet' }),
 *   network: 'mainnet-beta',
 * });
 * ```
 */

export { MoonPayAdapter } from './adapter.js';
export { moonPayAdapterConfigSchema, isSandboxKey } from './config.js';
export type { MoonPayAdapterConfig } from './config.js';
export { requestUrlSignature } from './url-signer.js';
