/**
 * @file errors.ts
 * @description Typed error classes for the solana-onramp library.
 *
 * Using typed error classes instead of generic `Error` allows callers to
 * distinguish between different failure modes using `instanceof` checks or
 * by inspecting the `code` field. This is especially useful in Result<T>
 * patterns where the error type is part of the API contract.
 *
 * All errors extend the base `OnrampError` class for easy catch-all handling.
 */

/**
 * Base error class for all solana-onramp library errors.
 *
 * Extend this class (not `Error` directly) when creating new error types
 * within this library. This allows consumers to catch all library errors
 * with a single `instanceof OnrampError` check.
 *
 * @example
 * ```ts
 * try {
 *   await client.topup(params);
 * } catch (err) {
 *   if (err instanceof OnrampError) {
 *     console.error('Onramp library error:', err.code, err.message);
 *   }
 * }
 * ```
 */
export class OnrampError extends Error {
  /**
   * A machine-readable error code for programmatic handling.
   * Useful for logging, analytics, and conditional UI messaging.
   */
  readonly code: string;

  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = 'OnrampError';
    this.code = code;
    // Preserve the original error in the `cause` field (ES2022+)
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/**
 * Thrown when a price oracle fails to return a valid price.
 *
 * This can happen when:
 * - The oracle network is unreachable
 * - The price feed is stale or halted
 * - The response format is unexpected
 *
 * @example
 * ```ts
 * const result = await client.getSOLPrice();
 * if (!result.success && result.error instanceof OracleError) {
 *   showFallbackPrice();
 * }
 * ```
 */
export class OracleError extends OnrampError {
  constructor(message: string, cause?: unknown) {
    super(message, 'ORACLE_ERROR', cause);
    this.name = 'OracleError';
  }
}

/**
 * Thrown when a price oracle returns an unavailable or invalid price.
 *
 * Distinct from `OracleError` (network/infrastructure failure) — this error
 * means the oracle was reached successfully but the price is not usable.
 * For example, a Pyth feed with status `Halted` or `Unknown`.
 *
 * @example
 * ```ts
 * // Pyth returned status 'Halted' for SOL/USD
 * throw new PriceUnavailableError('SOL/USD price feed is halted');
 * ```
 */
export class PriceUnavailableError extends OnrampError {
  constructor(message: string, cause?: unknown) {
    super(message, 'PRICE_UNAVAILABLE', cause);
    this.name = 'PriceUnavailableError';
  }
}

/**
 * Thrown when a SOL fee collection transaction fails.
 *
 * This can happen when:
 * - The payer wallet has insufficient balance
 * - The Solana transaction was rejected by the network
 * - The RPC connection is unavailable
 *
 * @example
 * ```ts
 * const result = await client.collectFee(feeParams);
 * if (!result.success && result.error instanceof FeeCollectionError) {
 *   // Show "insufficient balance" message to user
 * }
 * ```
 */
export class FeeCollectionError extends OnrampError {
  constructor(message: string, cause?: unknown) {
    super(message, 'FEE_COLLECTION_FAILED', cause);
    this.name = 'FeeCollectionError';
  }
}

/**
 * Thrown by adapter stubs that have not yet been implemented.
 *
 * Used in placeholder adapters (e.g., `adapter-transak`) to signal that the
 * feature exists in the architecture but has not been built yet.
 *
 * If you see this error at runtime, it means you are using an unimplemented adapter.
 * Check the adapter's CONTEXT.md for implementation status.
 *
 * @example
 * ```ts
 * async openWidget(params: TopupParams): Promise<TopupResult> {
 *   throw new NotImplementedError('TransakAdapter.openWidget');
 * }
 * ```
 */
export class NotImplementedError extends OnrampError {
  constructor(featureName: string) {
    super(`Not implemented: ${featureName}`, 'NOT_IMPLEMENTED');
    this.name = 'NotImplementedError';
  }
}

/**
 * Thrown when input validation fails (invalid params, missing required fields, etc.).
 *
 * This is distinct from business logic errors. It signals programmer error
 * (wrong types, missing required params) rather than runtime conditions.
 *
 * @example
 * ```ts
 * throw new ValidationError('walletAddress must be a valid Solana public key');
 * ```
 */
export class ValidationError extends OnrampError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
