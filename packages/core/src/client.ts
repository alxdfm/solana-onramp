/**
 * @file client.ts
 * @description The main entry point for interacting with solana-onramp functionality.
 *
 * `OnrampClient` is the orchestrator — it holds references to an onramp adapter
 * (fiat-to-crypto provider) and a price oracle adapter (SOL/USD price source),
 * and exposes a clean, Result<T>-based API to the application layer.
 *
 * ## How it fits in the architecture
 *
 * ```
 * Application Code
 *      │
 *      ▼
 * OnrampClient          ← you are here
 *      ├── OnrampAdapter   (MoonPay, Transak, ...)
 *      └── PriceOracleAdapter (Pyth, CoinGecko, ...)
 * ```
 *
 * The client NEVER throws. All public methods return `Result<T>`, catching any
 * errors thrown by the adapters and wrapping them in `{ success: false, error }`.
 *
 * ## Dependency Injection
 *
 * Both adapters are injected at construction time. This means:
 * - You can swap providers without changing the client API
 * - Tests can inject mock adapters without network calls
 * - The client has no import-time coupling to any SDK
 */

import { SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { FeeCollectionError, OracleError, OnrampError, ValidationError } from './errors.js';
import { usdToLamports } from './fee.js';
import type {
  FeeParams,
  Network,
  OnrampAdapter,
  OnrampClientConfig,
  PriceOracleAdapter,
  Result,
  TopupParams,
  TopupResult,
  TransactionSignature,
} from './types.js';

/**
 * The main client for solana-onramp operations.
 *
 * Create one instance per application (or per user session) using `createOnrampClient`.
 * The client is stateless beyond its injected adapters — it is safe to reuse across
 * multiple calls and to share between components.
 *
 * @example
 * ```ts
 * import { createOnrampClient } from '@callydus/onramp-core';
 * import { MoonPayAdapter } from '@callydus/onramp-adapter-moonpay';
 * import { PythOracleAdapter } from '@callydus/onramp-oracle-pyth';
 *
 * const client = createOnrampClient({
 *   onrampAdapter: new MoonPayAdapter({ apiKey: process.env.MOONPAY_API_KEY }),
 *   oracleAdapter: new PythOracleAdapter({ cluster: 'pythnet' }),
 *   network: 'mainnet-beta',
 * });
 *
 * const result = await client.topup({
 *   walletAddress: userWallet.publicKey.toString(),
 *   amountFiat: 100,
 *   currency: 'USD',
 * });
 *
 * if (result.success) {
 *   console.log('Topup status:', result.data.status);
 * }
 * ```
 */
export class OnrampClient {
  /** The Solana network this client targets. Used for validation and logging. */
  readonly network: Network;

  /**
   * The onramp provider adapter. Responsible for opening the fiat purchase widget.
   * Private — callers interact through the client's public methods.
   */
  private readonly onrampAdapter: OnrampAdapter;

  /**
   * The price oracle adapter. Responsible for fetching real-time SOL/USD prices.
   * Private — callers interact through the client's public methods.
   */
  private readonly oracleAdapter: PriceOracleAdapter;

  /**
   * Creates a new OnrampClient with the provided configuration.
   *
   * Prefer using the `createOnrampClient` factory function instead of calling
   * this constructor directly — the factory performs input validation.
   *
   * @param config - The client configuration containing adapters and network.
   */
  constructor(config: OnrampClientConfig) {
    this.onrampAdapter = config.onrampAdapter;
    this.oracleAdapter = config.oracleAdapter;
    this.network = config.network;
  }

  /**
   * Opens the onramp provider's widget, allowing the user to purchase SOL with fiat.
   *
   * This method delegates to the injected `OnrampAdapter`. The Result encapsulates
   * both the happy path (widget opened and user completed a purchase) and error cases
   * (widget failed to load, user cancelled, network error, etc.).
   *
   * @param params - Parameters for the topup operation (wallet address, amount, currency, etc.)
   * @returns A Result containing the TopupResult on success, or an OnrampError on failure.
   *
   * @example
   * ```ts
   * const result = await client.topup({
   *   walletAddress: 'G5T...xyz',
   *   amountFiat: 50,
   *   currency: 'USD',
   *   theme: 'dark',
   * });
   * if (result.success && result.data.status === 'success') {
   *   showSuccessToast(`Purchase ${result.data.transactionId} completed!`);
   * }
   * ```
   */
  async topup(params: TopupParams): Promise<Result<TopupResult>> {
    try {
      if (!params.walletAddress || params.walletAddress.trim().length === 0) {
        return {
          success: false,
          error: new ValidationError('walletAddress is required and must be non-empty'),
        };
      }
      const result = await this.onrampAdapter.openWidget(params);
      return { success: true, data: result };
    } catch (err) {
      const error =
        err instanceof OnrampError
          ? err
          : new OnrampError(
              `Onramp widget failed: ${err instanceof Error ? err.message : String(err)}`,
              'WIDGET_ERROR',
              err,
            );
      return { success: false, error };
    }
  }

  /**
   * Returns the current price of 1 SOL in USD.
   *
   * Uses the injected price oracle adapter. The price is fetched fresh on each call —
   * there is no caching in this client. If you need caching, implement it in the oracle
   * adapter or at the call site.
   *
   * @returns A Result containing the USD price as a number (e.g., 150.42),
   *          or an OracleError if the price could not be fetched.
   *
   * @example
   * ```ts
   * const result = await client.getSOLPrice();
   * if (result.success) {
   *   console.log(`1 SOL = $${result.data}`);
   * }
   * ```
   */
  async getSOLPrice(): Promise<Result<number>> {
    try {
      const price = await this.oracleAdapter.getSOLPrice();
      return { success: true, data: price };
    } catch (err) {
      const error =
        err instanceof OracleError
          ? err
          : new OracleError(
              `Failed to fetch SOL price: ${err instanceof Error ? err.message : String(err)}`,
              err,
            );
      return { success: false, error };
    }
  }

  /**
   * Converts a USD amount to its equivalent in lamports using the current SOL price.
   *
   * Internally: fetches the SOL price from the oracle, then applies the conversion
   * formula: `lamports = round((amountUSD / solPrice) * 1_000_000_000)`.
   *
   * This is used before `collectFee` to determine how many lamports to transfer.
   *
   * @param amountUSD - The amount in USD to convert. Must be a positive number.
   * @returns A Result containing the lamport amount as a bigint,
   *          or an OracleError/ValidationError if the conversion failed.
   *
   * @example
   * ```ts
   * const result = await client.convertUSDToLamports(1.50);
   * if (result.success) {
   *   console.log(`$1.50 = ${result.data} lamports`);
   * }
   * ```
   */
  async convertUSDToLamports(amountUSD: number): Promise<Result<bigint>> {
    if (!Number.isFinite(amountUSD) || amountUSD <= 0) {
      return {
        success: false,
        error: new ValidationError(`amountUSD must be positive, got: ${amountUSD}`),
      };
    }

    try {
      const price = await this.oracleAdapter.getSOLPrice();
      const lamports = usdToLamports(amountUSD, price);
      return { success: true, data: lamports };
    } catch (err) {
      const error =
        err instanceof OracleError
          ? err
          : new OracleError(
              `Failed to convert USD to lamports: ${err instanceof Error ? err.message : String(err)}`,
              err,
            );
      return { success: false, error };
    }
  }

  /**
   * Collects a fee in SOL by transferring lamports from the user's wallet to the treasury.
   *
   * ## What this does
   * 1. Converts `params.amountUSD` to lamports using the price oracle
   * 2. Builds a `SystemProgram.transfer` instruction
   * 3. Creates and sends a transaction to the Solana network
   * 4. Returns the transaction signature on success
   *
   * ## Important: wallet signing
   * This method creates and sends the transaction using `sendAndConfirmTransaction`.
   * In browser environments, you typically want to use a wallet adapter (e.g.,
   * `@solana/wallet-adapter-react`) to sign the transaction instead.
   * This method is better suited for backend/server-side fee collection where you
   * hold the keypair. For frontend use, prefer the `useFee` React hook which
   * handles wallet signing via the wallet adapter.
   *
   * @param params - Fee collection parameters (from, treasury, amountUSD, connection).
   * @returns A Result containing the transaction signature string on success,
   *          or a FeeCollectionError/OracleError on failure.
   *
   * @example
   * ```ts
   * const result = await client.collectFee({
   *   from: userKeypair.publicKey,
   *   treasury: new PublicKey(TREASURY_ADDRESS),
   *   amountUSD: 1.50,
   *   connection: new Connection(rpcUrl),
   * });
   * if (result.success) {
   *   console.log('Fee collected! Signature:', result.data);
   * }
   * ```
   */
  async collectFee(params: FeeParams): Promise<Result<TransactionSignature>> {
    if (params.amountUSD <= 0) {
      return {
        success: false,
        error: new ValidationError(`amountUSD must be positive, got: ${params.amountUSD}`),
      };
    }

    // Step 1: Get the current SOL price to determine how many lamports to transfer
    const lamportsResult = await this.convertUSDToLamports(params.amountUSD);
    if (!lamportsResult.success) {
      return lamportsResult;
    }

    try {
      // Step 2: Build the transfer instruction
      // SystemProgram.transfer is the standard Solana instruction for sending SOL.
      // It deducts `lamports` from `fromPubkey` and adds them to `toPubkey`.
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: params.from,
        toPubkey: params.treasury,
        lamports: lamportsResult.data,
      });

      // Step 3: Wrap the instruction in a transaction
      const transaction = new Transaction().add(transferInstruction);

      // Step 4: Send and confirm the transaction
      // `sendAndConfirmTransaction` submits to the network and polls until confirmed.
      // This is a blocking call — consider using the React hook for non-blocking UX.
      const signature = await sendAndConfirmTransaction(params.connection, transaction, []);

      return { success: true, data: signature };
    } catch (err) {
      const error =
        err instanceof FeeCollectionError
          ? err
          : new FeeCollectionError(
              `Fee collection failed: ${err instanceof Error ? err.message : String(err)}`,
              err,
            );
      return { success: false, error };
    }
  }
}

/**
 * Factory function for creating an OnrampClient.
 *
 * Prefer this over `new OnrampClient(config)` — this function performs input
 * validation and provides a cleaner API.
 *
 * @param config - The client configuration. See `OnrampClientConfig` for details.
 * @returns A fully configured OnrampClient ready to use.
 * @throws {ValidationError} If the config is missing required fields.
 *
 * @example
 * ```ts
 * const client = createOnrampClient({
 *   onrampAdapter: new MoonPayAdapter({ apiKey: 'pk_live_...' }),
 *   oracleAdapter: new PythOracleAdapter({ cluster: 'pythnet' }),
 *   network: 'mainnet-beta',
 * });
 * ```
 */
export function createOnrampClient(config: OnrampClientConfig): OnrampClient {
  if (!config.onrampAdapter) {
    throw new ValidationError('onrampAdapter is required');
  }
  if (!config.oracleAdapter) {
    throw new ValidationError('oracleAdapter is required');
  }
  if (!config.network) {
    throw new ValidationError('network is required');
  }
  return new OnrampClient(config);
}
