/**
 * @file config.ts
 * @description Configuration schema and types for the MoonPay adapter.
 *
 * This file defines:
 * - The Zod validation schema for MoonPayAdapterConfig
 * - The TypeScript type inferred from that schema
 * - The MoonPay API key format validation (pk_test_ vs pk_live_)
 *
 * ## MoonPay environment detection
 *
 * MoonPay determines the environment (sandbox vs production) from the API key prefix:
 * - `pk_test_...` → sandbox (no real money, test cards work)
 * - `pk_live_...` → production (real money, real KYC required)
 *
 * There is no separate environment flag — the key IS the environment selector.
 * This prevents the common mistake of using a production key with sandbox=true.
 */

import { z } from 'zod';

/**
 * Zod schema for validating MoonPay adapter configuration.
 *
 * Zod is used here (not a separate TypeScript interface) to enable runtime validation.
 * Configuration often comes from environment variables or external sources that can't
 * be type-checked at compile time. Zod catches these issues at startup.
 *
 * @see https://docs.moonpay.com/moonpay/implementation-guide/on-ramp/web-sdk
 */
export const moonPayAdapterConfigSchema = z.object({
  /**
   * Your MoonPay publishable API key.
   *
   * Format: `pk_test_...` for sandbox, `pk_live_...` for production.
   * Never use the secret key here — this key is embedded in the frontend.
   */
  apiKey: z
    .string()
    .min(1, 'MoonPay API key cannot be empty')
    .refine(
      (key: string) => key.startsWith('pk_test_') || key.startsWith('pk_live_'),
      'MoonPay API key must start with "pk_test_" or "pk_live_"',
    ),

  /**
   * The URL of your backend endpoint that signs MoonPay widget URLs.
   *
   * MoonPay requires URL signing when `walletAddress` is set. Your backend
   * must compute an HMAC-SHA256 signature of the URL using your MoonPay secret key.
   *
   * This endpoint should accept: `POST { url: string }` and return `{ signature: string }`.
   *
   * Required when `walletAddress` will be passed to `openWidget`.
   */
  urlSignerEndpoint: z.string().url('urlSignerEndpoint must be a valid URL').optional(),

  /**
   * The default fiat currency code (ISO 4217) to use in the widget.
   * Defaults to 'usd' if not specified.
   *
   * Examples: 'usd', 'brl', 'eur'
   * Note: MoonPay uses lowercase currency codes internally.
   */
  defaultCurrencyCode: z.string().optional(),

  /**
   * How the MoonPay widget is displayed to the user.
   *
   * - `overlay`: Opens as a modal overlay on top of your app (recommended)
   * - `embedded`: Renders inline within a container element
   * - `newTab`: Opens in a new browser tab
   * - `newWindow`: Opens in a popup window
   *
   * Defaults to 'overlay'.
   */
  variant: z.enum(['overlay', 'embedded', 'newTab', 'newWindow']).default('overlay'),
});

/**
 * Configuration object for the MoonPayAdapter.
 *
 * Always construct this via the Zod schema to ensure runtime validation:
 * ```ts
 * const config = moonPayAdapterConfigSchema.parse({
 *   apiKey: process.env.MOONPAY_API_KEY,
 *   urlSignerEndpoint: '/api/sign-moonpay-url',
 * });
 * ```
 */
export type MoonPayAdapterConfig = z.infer<typeof moonPayAdapterConfigSchema>;

/**
 * Returns true if the given MoonPay API key is a sandbox (test) key.
 *
 * Use this to adjust behavior (e.g., skipping URL signing validation in tests,
 * logging warnings about using test keys in production).
 *
 * @param apiKey - The MoonPay publishable API key.
 * @returns `true` if the key starts with `pk_test_`, `false` otherwise.
 */
export function isSandboxKey(apiKey: string): boolean {
  return apiKey.startsWith('pk_test_');
}
