/**
 * @file useFee.ts
 * @description React hook for fee estimation and collection in SOL/lamports.
 *
 * This hook provides utilities for:
 * 1. Getting the current SOL/USD price
 * 2. Estimating how many lamports/SOL a USD fee amount corresponds to
 * 3. Collecting a fee by submitting a transfer transaction to Solana
 *
 * It reads the `OnrampClient` from `OnrampContext` and wraps its async methods
 * in React state management (loading, error tracking).
 *
 * ## Usage
 *
 * ```tsx
 * import { useFee } from '@callydus/onramp-react';
 * import { useWallet, useConnection } from '@solana/wallet-adapter-react';
 *
 * function FeeEstimator() {
 *   const { estimateFeeInSOL, solPrice, isLoading, error } = useFee();
 *   const [estimate, setEstimate] = useState<number | null>(null);
 *
 *   useEffect(() => {
 *     estimateFeeInSOL(1.50).then(setEstimate);
 *   }, [estimateFeeInSOL]);
 *
 *   return (
 *     <div>
 *       <p>SOL price: ${solPrice?.toFixed(2)}</p>
 *       <p>Fee $1.50 ≈ {estimate?.toFixed(6)} SOL</p>
 *       {isLoading && <p>Loading...</p>}
 *       {error && <p>Error: {error.message}</p>}
 *     </div>
 *   );
 * }
 * ```
 */

import { useCallback, useState } from 'react';
import type { FeeParams, TransactionSignature } from '@callydus/onramp-core';
import { LAMPORTS_PER_SOL } from '@callydus/onramp-core';
import { useOnrampClient } from './OnrampContext.js';

/**
 * The return value of the `useFee` hook.
 */
export interface UseFeeReturn {
  /**
   * Submits a SOL fee transfer transaction to the Solana network.
   *
   * Converts `params.amountUSD` to lamports using the current SOL price,
   * then creates and sends a `SystemProgram.transfer` instruction.
   *
   * @param params - Fee collection parameters (from, treasury, amountUSD, connection).
   * @returns The transaction signature string, or `null` if the operation failed.
   */
  collectFee: (params: FeeParams) => Promise<TransactionSignature | null>;

  /**
   * Estimates the fee in lamports for a given USD amount.
   *
   * Fetches the current SOL price and converts `amountUSD` to lamports.
   * Returns `null` if the price fetch fails.
   *
   * @param amountUSD - The fee amount in USD. Must be positive.
   * @returns The equivalent lamports as a bigint, or `null` on error.
   */
  estimateFeeInLamports: (amountUSD: number) => Promise<bigint | null>;

  /**
   * Estimates the fee in SOL for a given USD amount.
   *
   * Similar to `estimateFeeInLamports` but returns a human-readable SOL amount.
   * Useful for displaying "you will pay approximately X SOL" in the UI.
   *
   * @param amountUSD - The fee amount in USD. Must be positive.
   * @returns The equivalent SOL amount as a float, or `null` on error.
   */
  estimateFeeInSOL: (amountUSD: number) => Promise<number | null>;

  /**
   * The current price of 1 SOL in USD.
   * Populated after the first successful price fetch.
   * `null` before any price has been fetched, or after a fetch failure.
   */
  solPrice: number | null;

  /**
   * `true` while any fee operation (collectFee or estimate) is in progress.
   */
  isLoading: boolean;

  /**
   * The error from the most recent operation, or `null` if it succeeded.
   */
  error: Error | null;
}

/**
 * React hook for fee estimation and collection in SOL.
 *
 * Must be used inside an `<OnrampProvider>`. Throws if used outside one.
 *
 * All async operations set `isLoading = true` while in progress and update
 * `error` on failure. The `solPrice` state is updated after each price fetch.
 *
 * @returns `UseFeeReturn` — fee operations + state
 *
 * @example
 * ```tsx
 * const { estimateFeeInSOL, collectFee, solPrice } = useFee();
 * ```
 */
export function useFee(): UseFeeReturn {
  const client = useOnrampClient();

  /** Whether any fee operation is in progress. */
  const [isLoading, setIsLoading] = useState(false);

  /** Error from the last fee operation. */
  const [error, setError] = useState<Error | null>(null);

  /** The most recently fetched SOL/USD price. Updated on each successful price fetch. */
  const [solPrice, setSolPrice] = useState<number | null>(null);

  /**
   * Submits a fee collection transaction.
   *
   * This calls `client.collectFee()` which builds a SystemProgram.transfer instruction
   * and sends it to the Solana network. Returns the transaction signature on success.
   */
  const collectFee = useCallback(
    async (params: FeeParams): Promise<TransactionSignature | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await client.collectFee(params);

        if (result.success) {
          return result.data;
        }

        setError(result.error);
        return null;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  /**
   * Fetches the current SOL price and converts `amountUSD` to lamports.
   *
   * Also updates the `solPrice` state as a side effect, so the component can
   * display the current SOL price without a separate fetch.
   */
  const estimateFeeInLamports = useCallback(
    async (amountUSD: number): Promise<bigint | null> => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch the current SOL price
        const priceResult = await client.getSOLPrice();
        if (!priceResult.success) {
          setError(priceResult.error);
          return null;
        }

        // Update the cached SOL price as a side effect
        setSolPrice(priceResult.data);

        // Convert USD to lamports
        const lamportsResult = await client.convertUSDToLamports(amountUSD);
        if (!lamportsResult.success) {
          setError(lamportsResult.error);
          return null;
        }

        return lamportsResult.data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  /**
   * Fetches the current SOL price and converts `amountUSD` to a SOL float.
   *
   * Internally calls `estimateFeeInLamports` and divides by LAMPORTS_PER_SOL.
   * This provides a human-readable SOL amount (e.g., `0.01` instead of `10000000n`).
   */
  const estimateFeeInSOL = useCallback(
    async (amountUSD: number): Promise<number | null> => {
      const lamports = await estimateFeeInLamports(amountUSD);
      if (lamports === null) return null;

      // Convert bigint lamports to float SOL
      // Number(lamports) is safe for any realistic fee amount
      return Number(lamports) / Number(LAMPORTS_PER_SOL);
    },
    [estimateFeeInLamports],
  );

  return {
    collectFee,
    estimateFeeInLamports,
    estimateFeeInSOL,
    solPrice,
    isLoading,
    error,
  };
}
