/**
 * @file client.test.ts
 * @description Unit tests for OnrampClient.
 *
 * All external dependencies (adapters, Solana connection) are mocked.
 * These tests verify the client's orchestration logic: error wrapping,
 * Result<T> behavior, input validation, and delegation to adapters.
 *
 * Test strategy:
 * - Happy path: each method returns `{ success: true, data }` when adapters succeed
 * - Error wrapping: adapter errors are caught and returned as `{ success: false, error }`
 * - Input validation: invalid params return ValidationError before calling adapters
 * - Delegation: client calls the right adapter methods with the right arguments
 */

import { describe, expect, it, vi } from 'vitest';
import { createOnrampClient, OnrampClient } from '../client.js';
import { OracleError, ValidationError } from '../errors.js';
import type { OnrampAdapter, OnrampClientConfig, PriceOracleAdapter, TopupResult } from '../types.js';

// Mock @solana/web3.js to avoid CJS/ESM interop issues with rpc-websockets in tests.
// The client tests don't exercise the Solana network — we only test orchestration logic.
vi.mock('@solana/web3.js', () => ({
  SystemProgram: { transfer: vi.fn().mockReturnValue({}) },
  Transaction: vi.fn().mockImplementation(() => ({ add: vi.fn().mockReturnThis() })),
  sendAndConfirmTransaction: vi.fn().mockResolvedValue('mock-signature'),
  PublicKey: vi.fn().mockImplementation((v: string) => ({ toBase58: () => v })),
  Connection: vi.fn(),
}));

// ─── Mock factories ─────────────────────────────────────────────────────────────

/**
 * Creates a mock OnrampAdapter that succeeds by default.
 * Individual methods can be overridden using `vi.fn()` spies.
 */
function createMockOnrampAdapter(overrides: Partial<OnrampAdapter> = {}): OnrampAdapter {
  return {
    openWidget: vi.fn().mockResolvedValue({
      status: 'success',
      transactionId: 'mock-tx-123',
    } satisfies TopupResult),
    getSupportedCurrencies: vi.fn().mockResolvedValue(['USD', 'EUR', 'BRL']),
    getSupportedCountries: vi.fn().mockResolvedValue(['US', 'DE', 'BR']),
    ...overrides,
  };
}

/**
 * Creates a mock PriceOracleAdapter that returns $150 for SOL by default.
 */
function createMockOracleAdapter(overrides: Partial<PriceOracleAdapter> = {}): PriceOracleAdapter {
  return {
    getSOLPrice: vi.fn().mockResolvedValue(150),
    getSOLAmount: vi.fn().mockImplementation(async (usd: number) => usd / 150),
    getSOLInLamports: vi.fn().mockImplementation(async (usd: number) =>
      BigInt(Math.round((usd / 150) * 1_000_000_000)),
    ),
    ...overrides,
  };
}

/**
 * Creates a default valid client config for testing.
 */
function createTestConfig(overrides: Partial<OnrampClientConfig> = {}): OnrampClientConfig {
  return {
    onrampAdapter: createMockOnrampAdapter(),
    oracleAdapter: createMockOracleAdapter(),
    network: 'devnet',
    ...overrides,
  };
}

// ─── createOnrampClient ─────────────────────────────────────────────────────────

describe('createOnrampClient', () => {
  it('creates a client when config is valid', () => {
    const client = createOnrampClient(createTestConfig());
    expect(client).toBeInstanceOf(OnrampClient);
  });

  it('exposes the network from config', () => {
    const client = createOnrampClient(createTestConfig({ network: 'mainnet-beta' }));
    expect(client.network).toBe('mainnet-beta');
  });

  it('throws ValidationError when onrampAdapter is missing', () => {
    expect(() =>
      createOnrampClient({
        onrampAdapter: null as unknown as OnrampAdapter,
        oracleAdapter: createMockOracleAdapter(),
        network: 'devnet',
      }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when oracleAdapter is missing', () => {
    expect(() =>
      createOnrampClient({
        onrampAdapter: createMockOnrampAdapter(),
        oracleAdapter: null as unknown as PriceOracleAdapter,
        network: 'devnet',
      }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when network is missing', () => {
    expect(() =>
      createOnrampClient({
        onrampAdapter: createMockOnrampAdapter(),
        oracleAdapter: createMockOracleAdapter(),
        network: null as unknown as 'devnet',
      }),
    ).toThrow(ValidationError);
  });
});

// ─── client.topup ──────────────────────────────────────────────────────────────

describe('OnrampClient.topup', () => {
  it('returns success result when adapter succeeds', async () => {
    const client = createOnrampClient(createTestConfig());
    const result = await client.topup({ walletAddress: 'G5TabcXyz123' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('success');
      expect(result.data.transactionId).toBe('mock-tx-123');
    }
  });

  it('calls adapter.openWidget with the correct params', async () => {
    const mockAdapter = createMockOnrampAdapter();
    const client = createOnrampClient(createTestConfig({ onrampAdapter: mockAdapter }));

    const params = {
      walletAddress: 'G5TabcXyz123',
      amountFiat: 100,
      currency: 'USD',
      theme: 'dark' as const,
    };

    await client.topup(params);
    expect(mockAdapter.openWidget).toHaveBeenCalledWith(params);
  });

  it('returns failure result when adapter throws', async () => {
    const mockAdapter = createMockOnrampAdapter({
      openWidget: vi.fn().mockRejectedValue(new Error('Widget SDK failed to load')),
    });
    const client = createOnrampClient(createTestConfig({ onrampAdapter: mockAdapter }));

    const result = await client.topup({ walletAddress: 'G5TabcXyz123' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Widget SDK failed to load');
    }
  });

  it('returns ValidationError when walletAddress is empty', async () => {
    const client = createOnrampClient(createTestConfig());
    const result = await client.topup({ walletAddress: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('returns ValidationError when walletAddress is only whitespace', async () => {
    const client = createOnrampClient(createTestConfig());
    const result = await client.topup({ walletAddress: '   ' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('does not call adapter when validation fails', async () => {
    const mockAdapter = createMockOnrampAdapter();
    const client = createOnrampClient(createTestConfig({ onrampAdapter: mockAdapter }));

    await client.topup({ walletAddress: '' });
    expect(mockAdapter.openWidget).not.toHaveBeenCalled();
  });
});

// ─── client.getSOLPrice ────────────────────────────────────────────────────────

describe('OnrampClient.getSOLPrice', () => {
  it('returns the price from the oracle on success', async () => {
    const mockOracle = createMockOracleAdapter({
      getSOLPrice: vi.fn().mockResolvedValue(175.42),
    });
    const client = createOnrampClient(createTestConfig({ oracleAdapter: mockOracle }));

    const result = await client.getSOLPrice();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(175.42);
    }
  });

  it('returns OracleError when oracle throws', async () => {
    const mockOracle = createMockOracleAdapter({
      getSOLPrice: vi.fn().mockRejectedValue(new Error('Pyth network unavailable')),
    });
    const client = createOnrampClient(createTestConfig({ oracleAdapter: mockOracle }));

    const result = await client.getSOLPrice();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(OracleError);
      expect(result.error.message).toContain('Pyth network unavailable');
    }
  });

  it('preserves OracleError type when oracle throws an OracleError', async () => {
    const originalError = new OracleError('Feed is halted');
    const mockOracle = createMockOracleAdapter({
      getSOLPrice: vi.fn().mockRejectedValue(originalError),
    });
    const client = createOnrampClient(createTestConfig({ oracleAdapter: mockOracle }));

    const result = await client.getSOLPrice();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(originalError);
    }
  });
});

// ─── client.convertUSDToLamports ───────────────────────────────────────────────

describe('OnrampClient.convertUSDToLamports', () => {
  it('converts $1.50 at SOL=$150 to 10,000,000 lamports', async () => {
    const mockOracle = createMockOracleAdapter({
      getSOLPrice: vi.fn().mockResolvedValue(150),
    });
    const client = createOnrampClient(createTestConfig({ oracleAdapter: mockOracle }));

    const result = await client.convertUSDToLamports(1.5);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(10_000_000n);
    }
  });

  it('returns ValidationError for zero amountUSD', async () => {
    const client = createOnrampClient(createTestConfig());
    const result = await client.convertUSDToLamports(0);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('returns ValidationError for negative amountUSD', async () => {
    const client = createOnrampClient(createTestConfig());
    const result = await client.convertUSDToLamports(-5);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('does not call oracle when validation fails', async () => {
    const mockOracle = createMockOracleAdapter();
    const client = createOnrampClient(createTestConfig({ oracleAdapter: mockOracle }));

    await client.convertUSDToLamports(-1);
    expect(mockOracle.getSOLPrice).not.toHaveBeenCalled();
  });

  it('returns OracleError when oracle fails during conversion', async () => {
    const mockOracle = createMockOracleAdapter({
      getSOLPrice: vi.fn().mockRejectedValue(new Error('Network timeout')),
    });
    const client = createOnrampClient(createTestConfig({ oracleAdapter: mockOracle }));

    const result = await client.convertUSDToLamports(1.0);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(OracleError);
    }
  });

  it('returns a bigint', async () => {
    const client = createOnrampClient(createTestConfig());
    const result = await client.convertUSDToLamports(1.0);

    if (result.success) {
      expect(typeof result.data).toBe('bigint');
    }
  });
});
