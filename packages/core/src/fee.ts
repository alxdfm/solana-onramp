/**
 * @file fee.ts
 * @description Pure functions for converting between USD, SOL, and lamports.
 *
 * These are the core financial calculations for fee collection.
 * They are pure functions (no side effects, deterministic output) making them
 * easy to test and reason about.
 *
 * ## Solana denomination primer
 *
 * Solana's native token is SOL. The smallest unit is called a **lamport**.
 * There are exactly 1,000,000,000 (one billion) lamports in 1 SOL.
 * This is similar to how Bitcoin has satoshis (100,000,000 per BTC) or
 * how Ethereum has wei (1,000,000,000,000,000,000 per ETH).
 *
 * All on-chain transfer instructions use lamports as integers — there is no
 * floating-point arithmetic on-chain. This avoids rounding errors in financial math.
 *
 * ## Why bigint?
 *
 * JavaScript's `number` type is a 64-bit float with ~15 significant digits.
 * For very high SOL prices or large fee amounts, intermediate calculations could
 * lose precision. `bigint` has arbitrary precision and is exact for integers.
 * The Solana SDK's `SystemProgram.transfer` accepts lamports as `bigint`.
 */

/**
 * The number of lamports in one SOL.
 *
 * Use this constant whenever converting between SOL and lamports to avoid
 * magic numbers in the codebase.
 *
 * Declared as `bigint` (note the `n` suffix) because lamports are always
 * integers and bigint arithmetic is exact.
 *
 * @example
 * ```ts
 * const oneSolInLamports = LAMPORTS_PER_SOL;  // 1000000000n
 * const halfSolInLamports = LAMPORTS_PER_SOL / 2n;  // 500000000n
 * ```
 */
export const LAMPORTS_PER_SOL = 1_000_000_000n;

/**
 * Converts a USD amount to the equivalent number of lamports, given the current SOL price.
 *
 * ## Formula
 * ```
 * lamports = round( (amountUSD / solPriceUSD) * 1_000_000_000 )
 * ```
 *
 * The result is rounded to the nearest integer because lamports are indivisible.
 * Rounding instead of truncating minimizes systematic under-collection of fees.
 *
 * ## Why not floating-point for lamports?
 * The calculation is done in floating-point first (`amountUSD / solPriceUSD * 1e9`),
 * then rounded and converted to bigint. This is safe because the intermediate value
 * fits comfortably within JavaScript's float64 precision range for any realistic
 * SOL price and USD fee amount.
 *
 * @param amountUSD - The fee amount in USD. Must be a positive finite number.
 * @param solPriceUSD - The current price of 1 SOL in USD. Must be positive and non-zero.
 * @returns The number of lamports equivalent to `amountUSD` at the given `solPriceUSD`.
 * @throws {RangeError} If either argument is not a positive finite number.
 *
 * @example
 * ```ts
 * // SOL is $150 USD. Collect a $1.50 fee.
 * const lamports = usdToLamports(1.50, 150);
 * // lamports = round((1.50 / 150) * 1_000_000_000) = round(10_000_000) = 10_000_000n
 *
 * // SOL is $200 USD. Collect a $0.50 fee.
 * const lamports = usdToLamports(0.50, 200);
 * // lamports = round((0.50 / 200) * 1_000_000_000) = round(2_500_000) = 2_500_000n
 * ```
 */
export function usdToLamports(amountUSD: number, solPriceUSD: number): bigint {
  if (!Number.isFinite(amountUSD) || amountUSD <= 0) {
    throw new RangeError(`amountUSD must be a positive finite number, got: ${amountUSD}`);
  }
  if (!Number.isFinite(solPriceUSD) || solPriceUSD <= 0) {
    throw new RangeError(`solPriceUSD must be a positive finite number, got: ${solPriceUSD}`);
  }

  // Step 1: Compute how many SOL the USD amount buys
  const solAmount = amountUSD / solPriceUSD;

  // Step 2: Convert SOL to lamports (multiply by 1 billion)
  const lamportsFloat = solAmount * 1_000_000_000;

  // Step 3: Round to nearest integer and convert to bigint
  // Math.round is used (not Math.floor) to minimize systematic rounding error
  return BigInt(Math.round(lamportsFloat));
}

/**
 * Converts a lamport amount back to its USD equivalent, given the current SOL price.
 *
 * This is the inverse of `usdToLamports`. Useful for displaying fee amounts to
 * users in their local currency, or for logging/auditing purposes.
 *
 * ## Formula
 * ```
 * usd = (lamports / 1_000_000_000) * solPriceUSD
 * ```
 *
 * @param lamports - The number of lamports. Must be a non-negative bigint.
 * @param solPriceUSD - The current price of 1 SOL in USD. Must be positive and non-zero.
 * @returns The USD value as a floating-point number.
 * @throws {RangeError} If `solPriceUSD` is not a positive finite number.
 *
 * @example
 * ```ts
 * // 10,000,000 lamports at SOL=$150
 * const usd = lamportsToUSD(10_000_000n, 150);
 * // usd = (10_000_000 / 1_000_000_000) * 150 = 0.01 * 150 = 1.5
 * ```
 */
export function lamportsToUSD(lamports: bigint, solPriceUSD: number): number {
  if (!Number.isFinite(solPriceUSD) || solPriceUSD <= 0) {
    throw new RangeError(`solPriceUSD must be a positive finite number, got: ${solPriceUSD}`);
  }

  // Convert bigint lamports to a regular number for floating-point math
  // This is safe for any realistic lamport amount (up to Number.MAX_SAFE_INTEGER)
  const lamportsNumber = Number(lamports);
  const solAmount = lamportsNumber / 1_000_000_000;
  return solAmount * solPriceUSD;
}

/**
 * Converts a USD amount to SOL, given the current SOL price.
 *
 * Returns a floating-point number of SOL. Use `usdToLamports` when you need
 * an integer value for on-chain instructions.
 *
 * @param amountUSD - The amount in USD. Must be positive.
 * @param solPriceUSD - The current price of 1 SOL in USD. Must be positive.
 * @returns The equivalent amount of SOL as a floating-point number.
 * @throws {RangeError} If either argument is not a positive finite number.
 *
 * @example
 * ```ts
 * const sol = usdToSOL(100, 200);  // 0.5 SOL
 * ```
 */
export function usdToSOL(amountUSD: number, solPriceUSD: number): number {
  if (!Number.isFinite(amountUSD) || amountUSD <= 0) {
    throw new RangeError(`amountUSD must be a positive finite number, got: ${amountUSD}`);
  }
  if (!Number.isFinite(solPriceUSD) || solPriceUSD <= 0) {
    throw new RangeError(`solPriceUSD must be a positive finite number, got: ${solPriceUSD}`);
  }
  return amountUSD / solPriceUSD;
}
