/**
 * @file adapter.ts
 * @description Transak adapter stub for the solana-onramp library.
 *
 * ## Status: NOT IMPLEMENTED
 *
 * This file is a placeholder that establishes Transak's place in the architecture.
 * All methods throw `NotImplementedError`. This allows the package to be installed
 * as a dependency and type-checked without breaking builds, while making it clear
 * at runtime that Transak support is not yet available.
 *
 * ## How to implement
 *
 * When implementing Transak support:
 * 1. Install the Transak SDK: `pnpm add @transak/transak-sdk`
 * 2. Create a `config.ts` with Zod validation schema (similar to `adapter-moonpay/config.ts`)
 * 3. Replace the `NotImplementedError` throws with actual SDK calls
 * 4. Add tests in `src/__tests__/adapter.test.ts`
 * 5. Update this file and `CONTEXT.md` to reflect the implementation status
 *
 * ## About Transak
 *
 * Transak is a fiat-to-crypto on-ramp provider similar to MoonPay.
 * - Website: https://transak.com
 * - Documentation: https://docs.transak.com
 * - Solana support: Yes (SOL and SPL tokens)
 * - Key differentiator: Supports more local payment methods in Latin America and Asia
 *
 * @see https://docs.transak.com/docs/transak-one-javascript-sdk
 */

import type { OnrampAdapter, TopupParams, TopupResult } from '@callydus/onramp-core';
import { NotImplementedError } from '@callydus/onramp-core';

/**
 * Transak adapter for the solana-onramp library.
 *
 * **STATUS: Not implemented.** All methods throw `NotImplementedError`.
 *
 * See the file-level JSDoc for implementation guidance.
 *
 * @example
 * ```ts
 * // This will throw NotImplementedError at runtime!
 * const adapter = new TransakAdapter({ apiKey: '...' });
 * await adapter.openWidget({ walletAddress: '...' }); // throws NotImplementedError
 * ```
 */
export class TransakAdapter implements OnrampAdapter {
  /**
   * NOT IMPLEMENTED.
   *
   * When implemented, this will open the Transak widget for fiat-to-SOL purchases.
   *
   * @throws {NotImplementedError} Always — this method is not yet implemented.
   */
  async openWidget(_params: TopupParams): Promise<TopupResult> {
    throw new NotImplementedError('TransakAdapter.openWidget');
  }

  /**
   * NOT IMPLEMENTED.
   *
   * When implemented, this will return the list of fiat currencies supported by Transak.
   * Transak supports 100+ currencies in 150+ countries.
   *
   * @throws {NotImplementedError} Always — this method is not yet implemented.
   */
  async getSupportedCurrencies(): Promise<string[]> {
    throw new NotImplementedError('TransakAdapter.getSupportedCurrencies');
  }

  /**
   * NOT IMPLEMENTED.
   *
   * When implemented, this will return the list of countries supported by Transak.
   *
   * @throws {NotImplementedError} Always — this method is not yet implemented.
   */
  async getSupportedCountries(): Promise<string[]> {
    throw new NotImplementedError('TransakAdapter.getSupportedCountries');
  }
}
