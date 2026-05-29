/**
 * @file adapter.ts
 * @description MoonPay implementation of the OnrampAdapter interface.
 *
 * This adapter integrates the MoonPay JavaScript SDK (`@moonpay/moonpay-js`) with
 * the generic `OnrampAdapter` contract defined in `@callydus/onramp-core`. It handles:
 *
 * - Loading the MoonPay SDK lazily (only when the widget is first opened)
 * - Mapping generic `TopupParams` to MoonPay-specific widget parameters
 * - Resolving the Promise when the user completes or dismisses the widget
 * - Returning a normalized `TopupResult` regardless of MoonPay's internal event format
 *
 * ## How the MoonPay SDK works (v0.7.x)
 *
 * 1. `loadMoonPay()` (static import) — async, injects the MoonPay script into the DOM
 *    and returns an init function (the widget factory).
 * 2. Init function `moonPay({ flow, variant, params, handlers })` — creates the widget
 * 3. `widget.show()` — displays the widget to the user
 * 4. The `handlers` object receives lifecycle events (transaction completed, close, etc.)
 *
 * ## Transaction status mapping
 *
 * MoonPay's `TransactionStatus` → our `TopupResult.status`:
 * - `'completed'` → `'success'`
 * - `'pending'` | `'waitingPayment'` | `'waitingAuthorization'` → `'pending'`
 * - `'failed'` → `'failed'`
 * - widget closed without transaction → `'cancelled'`
 */

import type { OnrampAdapter, TopupParams, TopupResult } from '@callydus/onramp-core';
import { OnrampError } from '@callydus/onramp-core';
import { loadMoonPay } from '@moonpay/moonpay-js';
import { type MoonPayAdapterConfig, isSandboxKey, moonPayAdapterConfigSchema } from './config.js';

/**
 * MoonPay adapter for the solana-onramp library.
 *
 * Implements `OnrampAdapter` using the `@moonpay/moonpay-js` SDK (v0.7.x).
 *
 * @example
 * ```ts
 * import { MoonPayAdapter } from '@callydus/onramp-adapter-moonpay';
 * import { createOnrampClient } from '@callydus/onramp-core';
 *
 * const adapter = new MoonPayAdapter({
 *   apiKey: process.env.NEXT_PUBLIC_MOONPAY_API_KEY,
 *   variant: 'overlay',
 * });
 *
 * const client = createOnrampClient({
 *   onrampAdapter: adapter,
 *   oracleAdapter: ...,
 *   network: 'mainnet-beta',
 * });
 * ```
 */
export class MoonPayAdapter implements OnrampAdapter {
  /** Validated configuration for this adapter instance. */
  private readonly config: MoonPayAdapterConfig;

  /**
   * Creates a new MoonPayAdapter.
   *
   * @param rawConfig - The configuration object. Validated via Zod schema at construction time.
   * @throws {ZodError} If the configuration is invalid (e.g., bad API key format, invalid URL).
   */
  constructor(rawConfig: MoonPayAdapterConfig) {
    // Validate at construction time to catch configuration errors early —
    // better to fail at startup than at runtime when the user clicks "Buy SOL".
    this.config = moonPayAdapterConfigSchema.parse(rawConfig);

    if (isSandboxKey(this.config.apiKey)) {
      console.warn(
        '[MoonPayAdapter] Using sandbox API key (pk_test_...). ' +
          'Switch to a pk_live_... key for production.',
      );
    }
  }

  /**
   * Opens the MoonPay widget for fiat-to-SOL purchase.
   *
   * The returned Promise resolves when the user either:
   * - Completes a transaction (status: 'success' or 'pending')
   * - Closes the widget without completing (status: 'cancelled')
   *
   * The Promise rejects if the MoonPay SDK fails to load or initialize.
   * The OnrampClient will catch this and return `{ success: false, error }`.
   *
   * @param params - Generic topup parameters. Mapped to MoonPay-specific params internally.
   * @returns A `TopupResult` describing the outcome of the widget interaction.
   */
  async openWidget(params: TopupParams): Promise<TopupResult> {
    // Load the MoonPay SDK. loadMoonPay() injects the SDK script into the DOM
    // (if not already loaded) and returns the widget factory function.
    const moonPay = await loadMoonPay();

    if (!moonPay) {
      throw new OnrampError(
        'MoonPay SDK failed to initialize. Check your API key and network connectivity.',
        'MOONPAY_INIT_FAILED',
      );
    }

    // The Promise wraps the MoonPay widget's event-based API into async/await.
    // We resolve/reject this Promise from within the widget's event handlers.
    return new Promise<TopupResult>((resolve, reject) => {
      // Track whether a transaction was completed, so we can distinguish between
      // "closed after completing" (success/pending) and "closed without completing" (cancelled).
      let transactionCompleted = false;

      // Determine the MoonPay environment from the API key prefix.
      // In SDK v0.7.x, `environment` must be passed explicitly:
      // - 'sandbox' for pk_test_... keys (no real money)
      // - 'production' for pk_live_... keys (real money)
      const environment = isSandboxKey(this.config.apiKey) ? 'sandbox' : 'production';

      const widget = moonPay({
        flow: 'buy',
        variant: this.config.variant,
        environment,
        params: {
          apiKey: this.config.apiKey,
          // Lock the currency to SOL on the Solana network.
          // `currencyCode: 'sol'` selects Solana's native SOL token.
          currencyCode: 'sol',
          walletAddress: params.walletAddress,
          // Use baseCurrencyCode/Amount if the caller specified a fiat amount
          ...(params.currency && {
            baseCurrencyCode: params.currency.toLowerCase(),
          }),
          ...(params.amountFiat !== undefined && {
            baseCurrencyAmount: String(params.amountFiat),
          }),
          // Optional UX parameters
          ...(params.email !== undefined && { email: params.email }),
          ...(params.theme !== undefined && { theme: params.theme }),
          ...(params.language !== undefined && { language: params.language }),
          ...(this.config.defaultCurrencyCode !== undefined && {
            defaultCurrencyCode: this.config.defaultCurrencyCode,
          }),
        },
        handlers: {
          /**
           * Called when a MoonPay transaction has been completed (payment processed).
           *
           * Note: `status === 'completed'` means the crypto has been (or will be) sent.
           * `status === 'pending'` means payment was received but not yet processed.
           * Both are considered non-cancelled outcomes from the user's perspective.
           */
          async onTransactionCompleted(props) {
            transactionCompleted = true;

            // Map MoonPay's status to our normalized status
            const ourStatus: TopupResult['status'] =
              props.status === 'completed' ? 'success' : 'pending';

            resolve({
              status: ourStatus,
              transactionId: props.id,
            });
          },

          /**
           * Called when the widget is closed (either by the user or by the system).
           *
           * If a transaction was already completed, this close event fires afterward —
           * we ignore it in that case (Promise was already resolved by onTransactionCompleted).
           *
           * If no transaction was completed, the user cancelled.
           */
          async onClose() {
            if (!transactionCompleted) {
              resolve({ status: 'cancelled' });
            }
          },
        },
      });

      if (!widget) {
        reject(
          new OnrampError(
            'MoonPay widget initialization returned null. Verify your API key is valid.',
            'MOONPAY_WIDGET_NULL',
          ),
        );
        return;
      }

      // Display the widget to the user
      widget.show();
    });
  }

  /**
   * Returns the list of fiat currencies supported by MoonPay.
   *
   * Note: This is a static list covering the most common currencies.
   * MoonPay's actual supported currencies vary by country and payment method.
   * For a dynamic, exhaustive list, call the MoonPay Currencies REST API:
   * `GET https://api.moonpay.com/v3/currencies?apiKey=pk_test_...`
   *
   * @returns An array of uppercase ISO 4217 currency codes.
   */
  async getSupportedCurrencies(): Promise<string[]> {
    return [
      'USD', 'EUR', 'GBP', 'BRL', 'AUD', 'CAD', 'CHF', 'CZK', 'DKK', 'HKD',
      'HUF', 'IDR', 'ILS', 'INR', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD',
      'PHP', 'PLN', 'SEK', 'SGD', 'THB', 'TRY', 'TWD', 'ZAR',
    ];
  }

  /**
   * Returns the list of countries supported by MoonPay.
   *
   * Note: MoonPay availability varies by country and payment method.
   * This list includes major supported countries; check MoonPay's documentation
   * for the complete and current list.
   *
   * @returns An array of ISO 3166-1 alpha-2 country codes.
   */
  async getSupportedCountries(): Promise<string[]> {
    return [
      'US', 'GB', 'DE', 'FR', 'BR', 'AU', 'CA', 'CH', 'AT', 'BE',
      'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'GR', 'HR', 'HU',
      'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO',
      'SE', 'SI', 'SK', 'IS', 'LI', 'NO', 'NZ', 'SG', 'HK', 'JP',
    ];
  }
}
