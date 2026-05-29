/**
 * @file adapter.test.ts
 * @description Unit tests for MoonPayAdapter.
 *
 * The MoonPay SDK is mocked entirely — these tests verify that the adapter:
 * 1. Validates configuration correctly (API key format, URL format)
 * 2. Calls the MoonPay SDK factory with the correct parameters
 * 3. Handles lifecycle events (transaction completed, widget closed)
 * 4. Throws appropriate errors when the SDK fails to load
 *
 * ## Vitest hoisting and vi.mock
 *
 * `vi.mock` calls are hoisted to the top of the file before any `const`/`let`
 * declarations run. Any variable referenced in the `vi.mock` factory function must
 * therefore also be hoisted via `vi.hoisted()` — otherwise the variable would be
 * in the temporal dead zone (TDZ) when the factory executes.
 */

import { OnrampError } from '@callydus/onramp-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MoonPayAdapter } from '../adapter.js';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────
// `vi.hoisted` runs BEFORE vi.mock factories, so these references are safe to use
// inside the vi.mock factory below.

const { mockWidget, mockMoonPayFactory, mockLoadMoonPay, capturedConfig } = vi.hoisted(() => {
  /**
   * Captured factory config. We store it in a mutable object so we can access
   * the handlers (onClose, onTransactionCompleted) from within individual tests
   * to simulate widget lifecycle events.
   */
  const capturedConfig: {
    handlers?: Record<string, ((props?: unknown) => Promise<void>) | (() => Promise<void>)>;
    environment?: string;
  } = {};

  /** Mock widget returned by the MoonPay factory. */
  const mockWidget = { show: vi.fn() };

  /**
   * Mock MoonPay widget factory.
   * Captures the full config so tests can simulate widget events via handlers.
   */
  const mockMoonPayFactory = vi.fn().mockImplementation((config: typeof capturedConfig) => {
    Object.assign(capturedConfig, config);
    return mockWidget;
  });

  /** Mock loadMoonPay — resolves to the factory function synchronously. */
  const mockLoadMoonPay = vi.fn().mockResolvedValue(mockMoonPayFactory);

  return { mockWidget, mockMoonPayFactory, mockLoadMoonPay, capturedConfig };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────

/**
 * Mock @moonpay/moonpay-js to avoid loading the real SDK script in tests.
 * The loadMoonPay function is replaced with mockLoadMoonPay defined above.
 */
vi.mock('@moonpay/moonpay-js', () => ({
  loadMoonPay: mockLoadMoonPay,
}));

/**
 * Mock @solana/web3.js to avoid CJS/ESM interop issues with rpc-websockets.
 * MoonPay adapter tests don't use Solana connection directly.
 */
vi.mock('@solana/web3.js', () => ({
  SystemProgram: { transfer: vi.fn() },
  Transaction: vi.fn().mockImplementation(() => ({ add: vi.fn().mockReturnThis() })),
  sendAndConfirmTransaction: vi.fn(),
  PublicKey: vi.fn(),
  Connection: vi.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Flushes pending microtasks and Promises by running multiple setTimeout(0) rounds.
 *
 * One setTimeout(0) drains only the microtask queue that existed before the timer
 * fires. If those microtasks schedule new async work (e.g., `await loadMoonPay()`
 * resolves and then runs more async code), additional rounds are needed to drain
 * the full chain.
 */
async function flushPromises(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MoonPayAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset captured config between tests
    for (const key of Object.keys(capturedConfig)) {
      delete capturedConfig[key as keyof typeof capturedConfig];
    }
    // Restore default mock behavior
    mockMoonPayFactory.mockImplementation((config: typeof capturedConfig) => {
      Object.assign(capturedConfig, config);
      return mockWidget;
    });
    mockLoadMoonPay.mockResolvedValue(mockMoonPayFactory);
  });

  // ─── Constructor ───────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('accepts a valid test API key', () => {
      expect(
        () => new MoonPayAdapter({ apiKey: 'pk_test_abc123', variant: 'overlay' }),
      ).not.toThrow();
    });

    it('accepts a valid live API key', () => {
      expect(
        () => new MoonPayAdapter({ apiKey: 'pk_live_abc123', variant: 'overlay' }),
      ).not.toThrow();
    });

    it('throws when API key format is invalid', () => {
      expect(
        () => new MoonPayAdapter({ apiKey: 'invalid_key', variant: 'overlay' }),
      ).toThrow();
    });

    it('throws when API key is empty', () => {
      expect(
        () => new MoonPayAdapter({ apiKey: '', variant: 'overlay' }),
      ).toThrow();
    });

    it('throws when urlSignerEndpoint is not a valid URL', () => {
      expect(
        () =>
          new MoonPayAdapter({
            apiKey: 'pk_test_abc',
            urlSignerEndpoint: 'not-a-url',
            variant: 'overlay',
          }),
      ).toThrow();
    });
  });

  // ─── openWidget ────────────────────────────────────────────────────────────

  describe('openWidget', () => {
    it('shows the widget when called', async () => {
      const adapter = new MoonPayAdapter({ apiKey: 'pk_test_abc', variant: 'overlay' });

      const widgetPromise = adapter.openWidget({ walletAddress: 'G5TabcXyz' });
      await flushPromises();

      // Trigger onClose so the Promise resolves
      await capturedConfig.handlers?.['onClose']?.();
      await widgetPromise;

      expect(mockWidget.show).toHaveBeenCalledOnce();
    });

    it('resolves with status "cancelled" when widget is closed without transaction', async () => {
      const adapter = new MoonPayAdapter({ apiKey: 'pk_test_abc', variant: 'overlay' });
      const widgetPromise = adapter.openWidget({ walletAddress: 'G5TabcXyz' });
      await flushPromises();

      await capturedConfig.handlers?.['onClose']?.();
      const result = await widgetPromise;

      expect(result.status).toBe('cancelled');
    });

    it('resolves with status "pending" when transaction has pending status', async () => {
      const adapter = new MoonPayAdapter({ apiKey: 'pk_test_abc', variant: 'overlay' });
      const widgetPromise = adapter.openWidget({ walletAddress: 'G5TabcXyz' });
      await flushPromises();

      await capturedConfig.handlers?.['onTransactionCompleted']?.({
        status: 'pending',
        id: 'tx-456',
      });
      const result = await widgetPromise;

      expect(result.status).toBe('pending');
      expect(result.transactionId).toBe('tx-456');
    });

    it('resolves with status "success" when transaction has completed status', async () => {
      const adapter = new MoonPayAdapter({ apiKey: 'pk_test_abc', variant: 'overlay' });
      const widgetPromise = adapter.openWidget({ walletAddress: 'G5TabcXyz' });
      await flushPromises();

      await capturedConfig.handlers?.['onTransactionCompleted']?.({
        status: 'completed',
        id: 'tx-789',
      });
      const result = await widgetPromise;

      expect(result.status).toBe('success');
      expect(result.transactionId).toBe('tx-789');
    });

    it('throws OnrampError when loadMoonPay returns null/undefined', async () => {
      mockLoadMoonPay.mockResolvedValue(undefined);
      const adapter = new MoonPayAdapter({ apiKey: 'pk_test_abc', variant: 'overlay' });

      await expect(adapter.openWidget({ walletAddress: 'G5TabcXyz' })).rejects.toThrow(
        OnrampError,
      );
    });

    it('throws OnrampError when widget factory returns null', async () => {
      mockMoonPayFactory.mockReturnValue(null);
      const adapter = new MoonPayAdapter({ apiKey: 'pk_test_abc', variant: 'overlay' });

      await expect(
        adapter.openWidget({ walletAddress: 'G5TabcXyz' }),
      ).rejects.toThrow(OnrampError);
    });

    it('uses sandbox environment for pk_test_ keys', async () => {
      const adapter = new MoonPayAdapter({ apiKey: 'pk_test_abc', variant: 'overlay' });
      const widgetPromise = adapter.openWidget({ walletAddress: 'G5TabcXyz' });
      await flushPromises();

      expect(mockMoonPayFactory).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'sandbox' }),
      );

      await capturedConfig.handlers?.['onClose']?.();
      await widgetPromise;
    });

    it('uses production environment for pk_live_ keys', async () => {
      const adapter = new MoonPayAdapter({ apiKey: 'pk_live_abc', variant: 'overlay' });
      mockMoonPayFactory.mockClear();
      const widgetPromise = adapter.openWidget({ walletAddress: 'G5TabcXyz' });
      await flushPromises();

      expect(mockMoonPayFactory).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'production' }),
      );

      await capturedConfig.handlers?.['onClose']?.();
      await widgetPromise;
    });
  });

  // ─── getSupportedCurrencies ─────────────────────────────────────────────────

  describe('getSupportedCurrencies', () => {
    it('returns an array of currency codes', async () => {
      const adapter = new MoonPayAdapter({ apiKey: 'pk_test_abc', variant: 'overlay' });
      const currencies = await adapter.getSupportedCurrencies();

      expect(Array.isArray(currencies)).toBe(true);
      expect(currencies.length).toBeGreaterThan(0);
    });

    it('includes USD', async () => {
      const adapter = new MoonPayAdapter({ apiKey: 'pk_test_abc', variant: 'overlay' });
      const currencies = await adapter.getSupportedCurrencies();

      expect(currencies).toContain('USD');
    });

    it('includes BRL (Brazilian Real)', async () => {
      const adapter = new MoonPayAdapter({ apiKey: 'pk_test_abc', variant: 'overlay' });
      const currencies = await adapter.getSupportedCurrencies();

      expect(currencies).toContain('BRL');
    });
  });

  // ─── getSupportedCountries ──────────────────────────────────────────────────

  describe('getSupportedCountries', () => {
    it('returns an array of country codes', async () => {
      const adapter = new MoonPayAdapter({ apiKey: 'pk_test_abc', variant: 'overlay' });
      const countries = await adapter.getSupportedCountries();

      expect(Array.isArray(countries)).toBe(true);
      expect(countries.length).toBeGreaterThan(0);
    });

    it('includes US and BR', async () => {
      const adapter = new MoonPayAdapter({ apiKey: 'pk_test_abc', variant: 'overlay' });
      const countries = await adapter.getSupportedCountries();

      expect(countries).toContain('US');
      expect(countries).toContain('BR');
    });
  });
});
