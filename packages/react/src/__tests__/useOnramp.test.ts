/**
 * @file useOnramp.test.ts
 * @description Tests for useOnramp and useFee hooks.
 *
 * Uses React Testing Library's `renderHook` to test hooks in isolation.
 * The OnrampClient is mocked — no real adapters or network calls.
 *
 * Test strategy:
 * - Verify initial state (isLoading=false, error=null, lastResult=null)
 * - Verify state transitions during async operations
 * - Verify error handling when client methods fail
 * - Verify that the hooks throw outside a Provider
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { OnrampClient, TopupResult } from '@callydus/onramp-core';
import { OnrampProvider } from '../OnrampContext.js';
import { useOnramp } from '../useOnramp.js';
import { useFee } from '../useFee.js';

// ─── Mock OnrampClient ────────────────────────────────────────────────────────

/**
 * Creates a mock OnrampClient with all methods as vi.fn() spies.
 */
function createMockClient(overrides: Partial<OnrampClient> = {}): OnrampClient {
  return {
    network: 'devnet',
    topup: vi.fn().mockResolvedValue({
      success: true,
      data: { status: 'success', transactionId: 'tx-123' } satisfies TopupResult,
    }),
    getSOLPrice: vi.fn().mockResolvedValue({ success: true, data: 150 }),
    convertUSDToLamports: vi.fn().mockResolvedValue({ success: true, data: 10_000_000n }),
    collectFee: vi.fn().mockResolvedValue({ success: true, data: 'signature-abc' }),
    ...overrides,
  } as unknown as OnrampClient;
}

/**
 * Creates a React wrapper with OnrampProvider for testing hooks.
 */
function createWrapper(client: OnrampClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(OnrampProvider, { client }, children);
  };
}

// ─── useOnramp ────────────────────────────────────────────────────────────────

describe('useOnramp', () => {
  let mockClient: OnrampClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it('has correct initial state', () => {
    const { result } = renderHook(() => useOnramp(), {
      wrapper: createWrapper(mockClient),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lastResult).toBeNull();
  });

  it('sets isLoading=true during topup', async () => {
    // Make topup take a moment so we can observe isLoading
    let resolveTopup!: (value: unknown) => void;
    const pendingPromise = new Promise((res) => { resolveTopup = res; });
    vi.mocked(mockClient.topup).mockReturnValue(pendingPromise as ReturnType<OnrampClient['topup']>);

    const { result } = renderHook(() => useOnramp(), {
      wrapper: createWrapper(mockClient),
    });

    // Start topup (don't await — we want to observe loading state)
    act(() => { void result.current.topup({ walletAddress: 'G5TabcXyz' }); });

    expect(result.current.isLoading).toBe(true);

    // Resolve and wait for state update
    act(() => { resolveTopup({ success: true, data: { status: 'cancelled' } }); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('sets lastResult after successful topup', async () => {
    const { result } = renderHook(() => useOnramp(), {
      wrapper: createWrapper(mockClient),
    });

    await act(async () => {
      await result.current.topup({ walletAddress: 'G5TabcXyz' });
    });

    expect(result.current.lastResult).toEqual({ status: 'success', transactionId: 'tx-123' });
    expect(result.current.error).toBeNull();
  });

  it('sets error when client.topup returns failure', async () => {
    const testError = new Error('Adapter failed');
    vi.mocked(mockClient.topup).mockResolvedValue({
      success: false,
      error: testError,
    });

    const { result } = renderHook(() => useOnramp(), {
      wrapper: createWrapper(mockClient),
    });

    await act(async () => {
      await result.current.topup({ walletAddress: 'G5TabcXyz' });
    });

    expect(result.current.error).toBe(testError);
    expect(result.current.lastResult).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('provides a stable topup reference', () => {
    const { result, rerender } = renderHook(() => useOnramp(), {
      wrapper: createWrapper(mockClient),
    });

    const firstTopup = result.current.topup;
    rerender();
    const secondTopup = result.current.topup;

    // useCallback ensures the function reference is stable across renders
    expect(firstTopup).toBe(secondTopup);
  });
});

// ─── useFee ───────────────────────────────────────────────────────────────────

describe('useFee', () => {
  let mockClient: OnrampClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it('has correct initial state', () => {
    const { result } = renderHook(() => useFee(), {
      wrapper: createWrapper(mockClient),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.solPrice).toBeNull();
  });

  it('returns lamports from estimateFeeInLamports', async () => {
    const { result } = renderHook(() => useFee(), {
      wrapper: createWrapper(mockClient),
    });

    let lamports: bigint | null = null;
    await act(async () => {
      lamports = await result.current.estimateFeeInLamports(1.5);
    });

    expect(lamports).toBe(10_000_000n);
  });

  it('updates solPrice after estimateFeeInLamports', async () => {
    const { result } = renderHook(() => useFee(), {
      wrapper: createWrapper(mockClient),
    });

    await act(async () => {
      await result.current.estimateFeeInLamports(1.5);
    });

    expect(result.current.solPrice).toBe(150);
  });

  it('returns SOL from estimateFeeInSOL', async () => {
    // $1.50 at SOL=$150 → 10,000,000 lamports → 0.01 SOL
    const { result } = renderHook(() => useFee(), {
      wrapper: createWrapper(mockClient),
    });

    let sol: number | null = null;
    await act(async () => {
      sol = await result.current.estimateFeeInSOL(1.5);
    });

    expect(sol).toBeCloseTo(0.01, 6);
  });

  it('returns signature from collectFee', async () => {
    const { result } = renderHook(() => useFee(), {
      wrapper: createWrapper(mockClient),
    });

    let signature: string | null = null;
    const mockParams = {
      from: {} as never,
      treasury: {} as never,
      amountUSD: 1.5,
      connection: {} as never,
    };

    await act(async () => {
      signature = await result.current.collectFee(mockParams);
    });

    expect(signature).toBe('signature-abc');
    expect(result.current.error).toBeNull();
  });

  it('sets error when estimateFeeInLamports fails', async () => {
    const testError = new Error('Price unavailable');
    vi.mocked(mockClient.getSOLPrice).mockResolvedValue({
      success: false,
      error: testError,
    });

    const { result } = renderHook(() => useFee(), {
      wrapper: createWrapper(mockClient),
    });

    await act(async () => {
      await result.current.estimateFeeInLamports(1.5);
    });

    expect(result.current.error).toBe(testError);
  });

  it('sets error when collectFee fails', async () => {
    const testError = new Error('Insufficient balance');
    vi.mocked(mockClient.collectFee).mockResolvedValue({
      success: false,
      error: testError,
    });

    const { result } = renderHook(() => useFee(), {
      wrapper: createWrapper(mockClient),
    });

    const mockParams = {
      from: {} as never,
      treasury: {} as never,
      amountUSD: 1.5,
      connection: {} as never,
    };

    await act(async () => {
      await result.current.collectFee(mockParams);
    });

    expect(result.current.error).toBe(testError);
  });
});

// ─── Context requirement ───────────────────────────────────────────────────────

describe('hooks outside OnrampProvider', () => {
  it('useOnramp throws when used outside provider', () => {
    // Suppress React's error boundary logging for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useOnramp());
    }).toThrow(/OnrampProvider/);

    consoleSpy.mockRestore();
  });

  it('useFee throws when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useFee());
    }).toThrow(/OnrampProvider/);

    consoleSpy.mockRestore();
  });
});
