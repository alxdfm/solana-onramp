/**
 * @file types.ts
 * @description Public interfaces and types for the solana-onramp library.
 *
 * This file defines the contracts (interfaces) that every onramp provider adapter and
 * every price oracle adapter must satisfy. Consumers of this library depend only on
 * these types — never on a specific adapter implementation.
 *
 * Design principle: the core package has ZERO knowledge of any specific provider
 * (MoonPay, Transak, Pyth, CoinGecko). Adapters live in separate packages and are
 * injected at construction time via dependency injection.
 */

import type { Connection, PublicKey, TransactionSignature } from '@solana/web3.js';

// ─── Discriminated Union: Result<T> ────────────────────────────────────────────
//
// Instead of throwing errors in business logic, every operation that can fail
// returns a Result<T>. The caller checks `result.success` before accessing
// `result.data` or `result.error`. This makes error handling explicit and
// prevents unhandled exceptions from propagating unexpectedly.
//
// Inspired by Rust's Result<T, E> and aligned with the Callydus ecosystem pattern.

/**
 * A discriminated union representing either a successful result carrying `data`,
 * or a failure carrying an `error`.
 *
 * Use this as the return type for any function that can fail in a predictable way.
 *
 * @example
 * ```ts
 * async function fetchPrice(): Promise<Result<number>> {
 *   try {
 *     const price = await oracle.getSOLPrice();
 *     return { success: true, data: price };
 *   } catch (err) {
 *     return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
 *   }
 * }
 *
 * const result = await fetchPrice();
 * if (result.success) {
 *   console.log(result.data); // TypeScript knows this is `number`
 * } else {
 *   console.error(result.error.message); // TypeScript knows this is `E`
 * }
 * ```
 *
 * @template T - The type of the successful value.
 * @template E - The type of the error. Defaults to `Error`.
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// ─── Network ───────────────────────────────────────────────────────────────────

/**
 * The Solana network to target.
 *
 * - `mainnet-beta`: The production Solana network. Real money, irreversible transactions.
 * - `devnet`: A public test network. Free SOL from faucets. Used in development.
 * - `testnet`: A validator stress-test network. Rarely used by application developers.
 */
export type Network = 'mainnet-beta' | 'devnet' | 'testnet';

// ─── Onramp types ──────────────────────────────────────────────────────────────

/**
 * Parameters for initiating a crypto purchase using fiat currency.
 *
 * These parameters are passed to the onramp provider's widget. Each adapter
 * is responsible for mapping these generic parameters to the provider's specific API.
 *
 * @example
 * ```ts
 * const params: TopupParams = {
 *   walletAddress: 'G5T...xyz',
 *   amountFiat: 100,
 *   currency: 'USD',
 *   theme: 'dark',
 *   language: 'en',
 * };
 * ```
 */
export interface TopupParams {
  /**
   * The Solana wallet address that will receive the purchased SOL.
   * Must be a valid Base58-encoded Solana public key.
   */
  walletAddress: string;

  /**
   * The amount of fiat currency to spend.
   * Optional — when omitted, the provider widget will let the user type an amount.
   */
  amountFiat?: number;

  /**
   * ISO 4217 currency code for the fiat amount.
   * Examples: 'USD', 'BRL', 'EUR'.
   * Defaults to 'USD' when omitted.
   */
  currency?: string;

  /**
   * Email address to pre-fill in the provider's identity verification form.
   * Optional — the user can always fill it in manually.
   */
  email?: string;

  /**
   * Visual theme for the provider's widget.
   * Should match the host application's color scheme for a seamless UX.
   */
  theme?: 'dark' | 'light';

  /**
   * Widget language as an ISO 639-1 code (e.g., 'pt', 'en', 'es').
   * When omitted, the provider usually auto-detects from the browser locale.
   */
  language?: string;
}

/**
 * The result returned after an onramp widget interaction completes.
 *
 * The result may be success, pending, failed, or cancelled depending on
 * whether the user completed or abandoned the purchase flow.
 */
export interface TopupResult {
  /**
   * The final status of the onramp interaction.
   *
   * - `success`: Purchase was completed and funds are on their way to the wallet.
   * - `pending`: Purchase is processing (payment received, crypto not yet transferred).
   * - `failed`: Purchase failed due to a payment error or provider issue.
   * - `cancelled`: The user closed the widget before completing the purchase.
   */
  status: 'success' | 'pending' | 'failed' | 'cancelled';

  /**
   * The transaction ID assigned by the onramp provider.
   * Use this to look up the transaction status in the provider's dashboard.
   * May be undefined if the interaction was cancelled before a transaction was created.
   */
  transactionId?: string;
}

// ─── Adapter contracts ─────────────────────────────────────────────────────────

/**
 * The contract that every onramp provider adapter must implement.
 *
 * An onramp adapter is responsible for integrating with a specific fiat-to-crypto
 * provider (e.g., MoonPay, Transak). The OnrampClient depends on this interface,
 * not on any concrete implementation, enabling easy provider switching.
 *
 * Implementations are in separate packages:
 * - `@callydus/onramp-adapter-moonpay`
 * - `@callydus/onramp-adapter-transak`
 *
 * @example
 * ```ts
 * class MyCustomAdapter implements OnrampAdapter {
 *   async openWidget(params: TopupParams): Promise<TopupResult> {
 *     // integrate with your provider's SDK here
 *   }
 *   async getSupportedCurrencies(): Promise<string[]> {
 *     return ['USD', 'EUR'];
 *   }
 *   async getSupportedCountries(): Promise<string[]> {
 *     return ['US', 'DE', 'FR'];
 *   }
 * }
 * ```
 */
export interface OnrampAdapter {
  /**
   * Opens the provider's onramp widget with the given parameters.
   * Returns a TopupResult describing the final state of the interaction.
   *
   * Implementations MUST resolve (not reject) — all errors should be caught internally
   * and surfaced as `{ status: 'failed' }` or re-thrown for the client to catch and
   * wrap in a `Result<TopupResult, OnrampError>`.
   */
  openWidget(params: TopupParams): Promise<TopupResult>;

  /**
   * Returns the list of ISO 4217 fiat currency codes supported by this provider.
   * Used to validate `TopupParams.currency` before opening the widget.
   *
   * @example ['USD', 'EUR', 'BRL', 'GBP']
   */
  getSupportedCurrencies(): Promise<string[]>;

  /**
   * Returns the list of ISO 3166-1 alpha-2 country codes supported by this provider.
   * Used to inform the UI about geographic availability.
   *
   * @example ['US', 'BR', 'DE', 'GB']
   */
  getSupportedCountries(): Promise<string[]>;
}

// ─── Oracle types ──────────────────────────────────────────────────────────────

/**
 * The contract that every price oracle adapter must implement.
 *
 * A price oracle provides real-time SOL/USD price data. The OnrampClient uses this
 * to convert fee amounts expressed in USD to their equivalent in lamports (the
 * smallest unit of SOL, 1 SOL = 1,000,000,000 lamports).
 *
 * Implementations are in separate packages:
 * - `@callydus/onramp-oracle-pyth` — uses Pyth Network (high accuracy, on-chain)
 * - `@callydus/onramp-oracle-coingecko` — uses CoinGecko API (simpler, for dev/testing)
 *
 * @example
 * ```ts
 * const oracle: PriceOracleAdapter = new PythOracleAdapter({ cluster: 'pythnet' });
 * const price = await oracle.getSOLPrice();  // e.g., 150.42
 * const lamports = await oracle.getSOLInLamports(1.00);  // e.g., 6648n
 * ```
 */
export interface PriceOracleAdapter {
  /**
   * Returns the current price of 1 SOL in USD.
   *
   * @returns A positive number representing the USD price of one SOL.
   * @throws {OracleError} If the price feed is unavailable or stale.
   */
  getSOLPrice(): Promise<number>;

  /**
   * Returns the equivalent amount of SOL for a given USD value.
   *
   * Useful for displaying "you will receive approximately X SOL" in the UI.
   *
   * @param amountUSD - The fiat amount in USD. Must be positive.
   * @returns The amount of SOL, as a floating-point number.
   */
  getSOLAmount(amountUSD: number): Promise<number>;

  /**
   * Converts a USD amount to the equivalent amount in lamports.
   *
   * Lamports are the smallest unit of SOL on the Solana network.
   * 1 SOL = 1,000,000,000 (one billion) lamports.
   *
   * This is the value used directly in Solana transfer instructions when collecting fees.
   * The result is rounded to the nearest integer (no fractional lamports exist).
   *
   * @param amountUSD - The fee amount in USD. Must be positive.
   * @returns A bigint representing the integer number of lamports.
   */
  getSOLInLamports(amountUSD: number): Promise<bigint>;
}

// ─── Fee collection types ──────────────────────────────────────────────────────

/**
 * Parameters for collecting a SOL fee from a user's wallet.
 *
 * The fee amount is expressed in USD — the library handles conversion to lamports
 * using the injected price oracle. This allows the application to think in fiat
 * while the blockchain operates in lamports.
 *
 * @example
 * ```ts
 * const feeParams: FeeParams = {
 *   from: new PublicKey(userWalletAddress),
 *   treasury: new PublicKey(TREASURY_WALLET_ADDRESS),
 *   amountUSD: 1.50,  // $1.50 fee in USD
 *   connection: solanaConnection,
 * };
 * const result = await client.collectFee(feeParams);
 * ```
 */
export interface FeeParams {
  /**
   * The user's wallet public key — the payer of the fee.
   * This wallet must have sufficient SOL to cover the fee + transaction cost.
   *
   * Note: The wallet must sign the transaction. This library creates the instruction
   * but the caller is responsible for signing via their wallet adapter.
   */
  from: PublicKey;

  /**
   * The treasury wallet public key — the recipient of the fee.
   * This is the application's collection wallet.
   */
  treasury: PublicKey;

  /**
   * The fee amount expressed in USD.
   * Will be converted to lamports using the current SOL/USD price from the oracle.
   * Must be a positive number.
   */
  amountUSD: number;

  /**
   * An active Solana RPC connection used to submit the transfer transaction.
   * Create this once with `new Connection(rpcUrl)` and reuse it.
   */
  connection: Connection;
}

// ─── Client config ─────────────────────────────────────────────────────────────

/**
 * Configuration object for creating an OnrampClient.
 *
 * The client is provider-agnostic: you inject the specific adapter implementations
 * at construction time. This allows you to swap providers without changing the
 * application code that uses the client.
 *
 * @example
 * ```ts
 * import { createOnrampClient } from '@callydus/onramp-core';
 * import { MoonPayAdapter } from '@callydus/onramp-adapter-moonpay';
 * import { PythOracleAdapter } from '@callydus/onramp-oracle-pyth';
 *
 * const client = createOnrampClient({
 *   onrampAdapter: new MoonPayAdapter({ apiKey: 'pk_live_...' }),
 *   oracleAdapter: new PythOracleAdapter({ cluster: 'pythnet' }),
 *   network: 'mainnet-beta',
 * });
 * ```
 */
export interface OnrampClientConfig {
  /**
   * The onramp provider adapter to use for fiat-to-crypto purchases.
   * Must implement the OnrampAdapter interface.
   */
  onrampAdapter: OnrampAdapter;

  /**
   * The price oracle adapter to use for SOL/USD price lookups.
   * Must implement the PriceOracleAdapter interface.
   */
  oracleAdapter: PriceOracleAdapter;

  /**
   * The Solana network to target.
   * Adapters should be configured for the same network.
   */
  network: Network;
}

// ─── Re-export Solana types used throughout the library ────────────────────────
// These are re-exported here so consumers can import them from a single location.
export type { Connection, PublicKey, TransactionSignature };
