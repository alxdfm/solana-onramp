/**
 * @file useOnramp.ts
 * @description React hook for triggering fiat-to-crypto onramp (topup) flows.
 *
 * This hook provides a simple interface for opening the onramp provider's widget
 * and tracking the loading state and result. It reads the `OnrampClient` from
 * the `OnrampContext` (set up by `OnrampProvider`).
 *
 * ## Usage
 *
 * ```tsx
 * import { useOnramp } from '@callydus/onramp-react';
 *
 * function BuySOLButton({ walletAddress }: { walletAddress: string }) {
 *   const { topup, isLoading, lastResult, error } = useOnramp();
 *
 *   const handleClick = async () => {
 *     await topup({
 *       walletAddress,
 *       amountFiat: 100,
 *       currency: 'USD',
 *       theme: 'dark',
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleClick} disabled={isLoading}>
 *         {isLoading ? 'Opening...' : 'Buy SOL'}
 *       </button>
 *       {lastResult && <p>Status: {lastResult.status}</p>}
 *       {error && <p>Error: {error.message}</p>}
 *     </div>
 *   );
 * }
 * ```
 */

import { useCallback, useState } from 'react';
import type { TopupParams, TopupResult } from '@callydus/onramp-core';
import { useOnrampClient } from './OnrampContext.js';

/**
 * The return value of the `useOnramp` hook.
 */
export interface UseOnrampReturn {
  /**
   * Opens the onramp provider's widget with the given parameters.
   *
   * This function is stable (wrapped in `useCallback`) — safe to use as a
   * dependency in `useEffect` or to pass to child components without causing
   * unnecessary re-renders.
   *
   * @param params - Parameters for the topup (wallet address, amount, currency, etc.)
   */
  topup: (params: TopupParams) => Promise<void>;

  /**
   * The result of the most recent `topup` call.
   * `null` if `topup` has never been called in this component's lifecycle.
   */
  lastResult: TopupResult | null;

  /**
   * `true` while the onramp widget is open or loading.
   * Use this to disable the trigger button and show a loading indicator.
   */
  isLoading: boolean;

  /**
   * The error from the most recent `topup` call, or `null` if it succeeded.
   * Use this to display an error message to the user.
   */
  error: Error | null;
}

/**
 * React hook for initiating a fiat-to-SOL purchase via the onramp provider.
 *
 * Must be used inside an `<OnrampProvider>`. Throws if used outside one.
 *
 * Manages three state values:
 * - `isLoading`: tracks whether the widget is currently open
 * - `lastResult`: the `TopupResult` from the last completed interaction
 * - `error`: any error from the last call
 *
 * @returns `UseOnrampReturn` — topup function + state
 *
 * @example
 * ```tsx
 * const { topup, isLoading } = useOnramp();
 * <button onClick={() => topup({ walletAddress: userWallet })} disabled={isLoading} />
 * ```
 */
export function useOnramp(): UseOnrampReturn {
  const client = useOnrampClient();

  /** Whether the widget is currently open/loading. */
  const [isLoading, setIsLoading] = useState(false);

  /** The result of the last topup interaction. */
  const [lastResult, setLastResult] = useState<TopupResult | null>(null);

  /** Any error from the last topup call. */
  const [error, setError] = useState<Error | null>(null);

  /**
   * Opens the onramp widget.
   *
   * Sets `isLoading = true` before opening, resets it after.
   * Updates `lastResult` and `error` based on the outcome.
   */
  const topup = useCallback(
    async (params: TopupParams): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await client.topup(params);

        if (result.success) {
          setLastResult(result.data);
        } else {
          setError(result.error);
          setLastResult(null);
        }
      } catch (err) {
        // This should not happen (client.topup returns Result, never throws),
        // but defensive error handling is always good practice.
        setError(err instanceof Error ? err : new Error(String(err)));
        setLastResult(null);
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  return { topup, lastResult, isLoading, error };
}
