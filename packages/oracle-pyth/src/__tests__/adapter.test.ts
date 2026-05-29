/**
 * @file adapter.test.ts
 * @description Unit tests for PythOracleAdapter.
 *
 * The PythHttpClient and Solana Connection are mocked entirely.
 * These tests verify:
 * 1. Correct delegation to the PythHttpClient
 * 2. Error handling when the feed is unavailable (wrong status, null price, etc.)
 * 3. Correct conversion from Pyth price to lamports and SOL amounts
 * 4. Validation of adapter configuration
 */

import { OracleError, PriceUnavailableError } from '@callydus/onramp-core';
import { PriceStatus } from '@pythnetwork/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PythOracleAdapter } from '../adapter.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────────

/**
 * Mock `getData` result — simulates a Pyth data snapshot with a healthy SOL/USD feed.
 */
function createMockPythData(overrides: {
  price?: number | null;
  status?: string;
  confidence?: number;
} = {}) {
  const statusMap: Record<string, PriceStatus> = {
    Trading: PriceStatus.Trading,
    Halted: PriceStatus.Halted,
    Unknown: PriceStatus.Unknown,
  };

  const rawStatus = overrides.status ?? 'Trading';
  // Use `'price' in overrides` to distinguish "not provided" from "explicitly null"
  const price = 'price' in overrides ? overrides.price : 150;
  const feed = {
    price,
    confidence: overrides.confidence ?? 0.5,
    status: rawStatus in statusMap ? statusMap[rawStatus] : PriceStatus.Trading,
  };

  return {
    productPrice: new Map([['Crypto.SOL/USD', feed]]),
  };
}

/**
 * Mock PythHttpClient instance — methods are vi.fn() spies.
 */
const mockPythClient = {
  getData: vi.fn(),
  getAssetPricesFromAccounts: vi.fn(),
};

// Mock the @pythnetwork/client module so no real network calls happen.
// We must export PriceStatus as a numeric enum to match the real module's type.
vi.mock('@pythnetwork/client', () => {
  // Mirror the real PriceStatus enum values (0=Unknown, 1=Trading, 2=Halted)
  const PriceStatusEnum = { Unknown: 0, Trading: 1, Halted: 2, 0: 'Unknown', 1: 'Trading', 2: 'Halted' };

  return {
    PriceStatus: PriceStatusEnum,
    PythHttpClient: vi.fn().mockImplementation(() => mockPythClient),
    getPythClusterApiUrl: vi.fn().mockReturnValue('https://mock-pyth-rpc.com'),
    getPythProgramKeyForCluster: vi.fn().mockReturnValue({
      toBase58: () => 'MockProgramKey',
    }),
  };
});

// Mock @solana/web3.js Connection — we don't need real RPC calls
vi.mock('@solana/web3.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solana/web3.js')>();
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => ({})),
  };
});

// ─── Tests ───────────────────────────────────────────────────────────────────────

describe('PythOracleAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPythClient.getData.mockResolvedValue(createMockPythData());
  });

  // ─── Constructor ─────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('accepts valid config with cluster pythnet', () => {
      expect(() => new PythOracleAdapter({ cluster: 'pythnet', maxPriceAgeMs: 60_000 })).not.toThrow();
    });

    it('accepts valid config with cluster devnet', () => {
      expect(() => new PythOracleAdapter({ cluster: 'devnet', maxPriceAgeMs: 60_000 })).not.toThrow();
    });

    it('throws when cluster is invalid', () => {
      expect(
        () => new PythOracleAdapter({ cluster: 'invalid' as 'devnet', maxPriceAgeMs: 60_000 }),
      ).toThrow();
    });
  });

  // ─── getSOLPrice ──────────────────────────────────────────────────────────────

  describe('getSOLPrice', () => {
    it('returns the SOL price from Pyth data', async () => {
      mockPythClient.getData.mockResolvedValue(createMockPythData({ price: 175.42 }));
      const adapter = new PythOracleAdapter({ cluster: 'pythnet', maxPriceAgeMs: 60_000 });

      const price = await adapter.getSOLPrice();
      expect(price).toBe(175.42);
    });

    it('throws PriceUnavailableError when status is Halted', async () => {
      mockPythClient.getData.mockResolvedValue(
        createMockPythData({ status: 'Halted' }),
      );
      const adapter = new PythOracleAdapter({ cluster: 'pythnet', maxPriceAgeMs: 60_000 });

      await expect(adapter.getSOLPrice()).rejects.toThrow(PriceUnavailableError);
    });

    it('throws PriceUnavailableError when status is Unknown', async () => {
      mockPythClient.getData.mockResolvedValue(
        createMockPythData({ status: 'Unknown' }),
      );
      const adapter = new PythOracleAdapter({ cluster: 'pythnet', maxPriceAgeMs: 60_000 });

      await expect(adapter.getSOLPrice()).rejects.toThrow(PriceUnavailableError);
    });

    it('throws PriceUnavailableError when price is null', async () => {
      mockPythClient.getData.mockResolvedValue(
        createMockPythData({ price: null }),
      );
      const adapter = new PythOracleAdapter({ cluster: 'pythnet', maxPriceAgeMs: 60_000 });

      await expect(adapter.getSOLPrice()).rejects.toThrow(PriceUnavailableError);
    });

    it('throws PriceUnavailableError when price is zero or negative', async () => {
      mockPythClient.getData.mockResolvedValue(
        createMockPythData({ price: 0 }),
      );
      const adapter = new PythOracleAdapter({ cluster: 'pythnet', maxPriceAgeMs: 60_000 });

      await expect(adapter.getSOLPrice()).rejects.toThrow(PriceUnavailableError);
    });

    it('throws PriceUnavailableError when SOL/USD symbol not found', async () => {
      mockPythClient.getData.mockResolvedValue({
        productPrice: new Map(), // empty — no SOL/USD feed
      });
      const adapter = new PythOracleAdapter({ cluster: 'pythnet', maxPriceAgeMs: 60_000 });

      await expect(adapter.getSOLPrice()).rejects.toThrow(PriceUnavailableError);
    });

    it('throws OracleError when getData throws a network error', async () => {
      mockPythClient.getData.mockRejectedValue(new Error('RPC connection failed'));
      const adapter = new PythOracleAdapter({ cluster: 'pythnet', maxPriceAgeMs: 60_000 });

      await expect(adapter.getSOLPrice()).rejects.toThrow(OracleError);
    });
  });

  // ─── getSOLAmount ─────────────────────────────────────────────────────────────

  describe('getSOLAmount', () => {
    it('returns the correct SOL amount for a given USD value', async () => {
      mockPythClient.getData.mockResolvedValue(createMockPythData({ price: 200 }));
      const adapter = new PythOracleAdapter({ cluster: 'pythnet', maxPriceAgeMs: 60_000 });

      const sol = await adapter.getSOLAmount(100);
      expect(sol).toBeCloseTo(0.5, 10);
    });

    it('uses the current price from the oracle', async () => {
      mockPythClient.getData.mockResolvedValue(createMockPythData({ price: 150 }));
      const adapter = new PythOracleAdapter({ cluster: 'pythnet', maxPriceAgeMs: 60_000 });

      const sol = await adapter.getSOLAmount(75);
      expect(sol).toBeCloseTo(0.5, 10);
    });
  });

  // ─── getSOLInLamports ─────────────────────────────────────────────────────────

  describe('getSOLInLamports', () => {
    it('returns lamports as bigint', async () => {
      mockPythClient.getData.mockResolvedValue(createMockPythData({ price: 150 }));
      const adapter = new PythOracleAdapter({ cluster: 'pythnet', maxPriceAgeMs: 60_000 });

      const lamports = await adapter.getSOLInLamports(1.5);
      expect(typeof lamports).toBe('bigint');
    });

    it('returns 10,000,000n for $1.50 at SOL=$150', async () => {
      mockPythClient.getData.mockResolvedValue(createMockPythData({ price: 150 }));
      const adapter = new PythOracleAdapter({ cluster: 'pythnet', maxPriceAgeMs: 60_000 });

      const lamports = await adapter.getSOLInLamports(1.5);
      expect(lamports).toBe(10_000_000n);
    });

    it('propagates OracleError when price fetch fails', async () => {
      mockPythClient.getData.mockRejectedValue(new Error('timeout'));
      const adapter = new PythOracleAdapter({ cluster: 'pythnet', maxPriceAgeMs: 60_000 });

      await expect(adapter.getSOLInLamports(1.0)).rejects.toThrow(OracleError);
    });
  });
});
