/**
 * @file adapter.ts
 * @description CoinGecko implementation of the PriceOracleAdapter interface.
 *
 * ## ⚠️ IMPORTANT: Development/Testing Use Only
 *
 * This adapter uses the CoinGecko **free public API** (no authentication required).
 * It is NOT suitable for production use because:
 *
 * 1. **Rate limiting**: The free API allows ~10-30 requests/minute per IP.
 *    In production with multiple users, this will cause 429 Too Many Requests errors.
 *
 * 2. **No SLA**: The free tier has no uptime guarantee or support.
 *
 * 3. **Latency**: CoinGecko prices are updated every 1-2 minutes, not in real-time.
 *    For fee collection, this is usually acceptable, but it's less accurate than Pyth.
 *
 * **For production, use `@callydus/onramp-oracle-pyth` instead.**
 *
 * ## Why this adapter exists
 *
 * - No SDK to install, no API key needed — works out of the box
 * - Useful for `pnpm dev` local development
 * - Useful for unit tests and CI environments without Solana RPC access
 * - Provides a fallback when Pyth Network is unavailable
 *
 * ## API endpoint
 *
 * ```
 * GET https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd
 * Response: { "solana": { "usd": 150.42 } }
 * ```
 */

import type { PriceOracleAdapter } from '@callydus/onramp-core';
import { OracleError, PriceUnavailableError } from '@callydus/onramp-core';
import { usdToLamports, usdToSOL } from '@callydus/onramp-core';

/**
 * The CoinGecko API endpoint for fetching SOL/USD price.
 * Uses the free public API — no authentication required.
 */
const COINGECKO_SOL_USD_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd' as const;

/**
 * Expected response shape from the CoinGecko simple price API.
 * Typed explicitly to avoid using `any`.
 */
interface CoinGeckoPriceResponse {
  solana: {
    usd: number;
  };
}

/**
 * CoinGecko oracle adapter for the solana-onramp library.
 *
 * Uses the free CoinGecko public API to fetch the current SOL/USD price.
 * No configuration, no API key, no SDK installation required.
 *
 * **For development and testing only.** Use `PythOracleAdapter` in production.
 *
 * @example
 * ```ts
 * import { CoinGeckoOracleAdapter } from '@callydus/onramp-oracle-coingecko';
 *
 * const oracle = new CoinGeckoOracleAdapter();
 * const price = await oracle.getSOLPrice();  // fetches from CoinGecko API
 * ```
 */
export class CoinGeckoOracleAdapter implements PriceOracleAdapter {
  /**
   * Creates a new CoinGeckoOracleAdapter.
   *
   * No configuration is required — the free public API is used automatically.
   * A warning is logged in production environments to remind developers to switch
   * to a production-grade oracle.
   */
  constructor() {
    // Warn if used in a production-like environment.
    // NODE_ENV check is a convention — this is the best we can do without a config flag.
    if (typeof process !== 'undefined' && process.env['NODE_ENV'] === 'production') {
      console.warn(
        '[CoinGeckoOracleAdapter] WARNING: Using CoinGecko free API in production. ' +
          'This is subject to rate limiting and has no SLA. ' +
          'Switch to @callydus/onramp-oracle-pyth for production use.',
      );
    }
  }

  /**
   * Returns the current price of 1 SOL in USD from the CoinGecko API.
   *
   * Makes a GET request to CoinGecko's `/simple/price` endpoint.
   * This is a real HTTP request — network availability is required.
   *
   * @returns The USD price of 1 SOL as a positive number.
   * @throws {OracleError} If the network request fails or returns an unexpected status code.
   * @throws {PriceUnavailableError} If the response is missing the expected price data.
   *
   * @example
   * ```ts
   * const price = await oracle.getSOLPrice();  // e.g., 150.42
   * ```
   */
  async getSOLPrice(): Promise<number> {
    let response: Response;

    try {
      response = await fetch(COINGECKO_SOL_USD_URL, {
        // Include a descriptive User-Agent so CoinGecko can identify the caller
        headers: {
          Accept: 'application/json',
        },
        // Abort after 10 seconds to avoid hanging indefinitely
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      // Network error, DNS failure, timeout, etc.
      throw new OracleError(
        `Failed to reach CoinGecko API: ${err instanceof Error ? err.message : String(err)}. ` +
          'Check your network connectivity.',
        err,
      );
    }

    if (response.status === 429) {
      throw new OracleError(
        'CoinGecko API rate limit exceeded (429 Too Many Requests). ' +
          'The free tier allows ~10-30 requests/minute. ' +
          'Consider switching to @callydus/onramp-oracle-pyth for production.',
      );
    }

    if (!response.ok) {
      throw new OracleError(
        `CoinGecko API returned HTTP ${response.status} ${response.statusText}`,
      );
    }

    let body: CoinGeckoPriceResponse;
    try {
      body = (await response.json()) as CoinGeckoPriceResponse;
    } catch (err) {
      throw new OracleError('CoinGecko API returned invalid JSON', err);
    }

    const price = body?.solana?.usd;

    if (price === undefined || price === null) {
      throw new PriceUnavailableError(
        `CoinGecko API response missing solana.usd price. Received: ${JSON.stringify(body)}`,
      );
    }

    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
      throw new PriceUnavailableError(
        `CoinGecko returned an invalid SOL price: ${price}`,
      );
    }

    return price;
  }

  /**
   * Returns the equivalent amount of SOL for a given USD value.
   *
   * @param amountUSD - The amount in USD. Must be positive.
   * @returns The equivalent SOL amount.
   * @throws {OracleError} If the CoinGecko price fetch fails.
   */
  async getSOLAmount(amountUSD: number): Promise<number> {
    const price = await this.getSOLPrice();
    return usdToSOL(amountUSD, price);
  }

  /**
   * Converts a USD amount to the equivalent number of lamports.
   *
   * @param amountUSD - The amount in USD. Must be positive.
   * @returns The equivalent lamports as a bigint.
   * @throws {OracleError} If the CoinGecko price fetch fails.
   */
  async getSOLInLamports(amountUSD: number): Promise<bigint> {
    const price = await this.getSOLPrice();
    return usdToLamports(amountUSD, price);
  }
}
