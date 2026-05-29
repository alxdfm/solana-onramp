/**
 * @file fee.test.ts
 * @description Unit tests for USD ↔ lamports conversion functions.
 *
 * These tests verify the mathematical correctness of the fee conversion functions.
 * They are pure unit tests — no network calls, no mocks needed.
 *
 * Test strategy:
 * - Exact numeric cases (known inputs → known outputs)
 * - Edge cases (very small amounts, large amounts, decimal prices)
 * - Error cases (invalid inputs throw RangeError)
 * - Round-trip consistency (usdToLamports → lamportsToUSD should return approximately the original)
 */

import { describe, expect, it } from 'vitest';
import { LAMPORTS_PER_SOL, lamportsToUSD, usdToLamports, usdToSOL } from '../fee.js';

describe('LAMPORTS_PER_SOL', () => {
  it('should equal 1,000,000,000n', () => {
    // 1 SOL = 1 billion lamports — this is a protocol constant, never changes
    expect(LAMPORTS_PER_SOL).toBe(1_000_000_000n);
  });
});

describe('usdToLamports', () => {
  it('converts $1.50 at SOL=$150 correctly', () => {
    // $1.50 / $150 per SOL = 0.01 SOL = 10,000,000 lamports
    const result = usdToLamports(1.5, 150);
    expect(result).toBe(10_000_000n);
  });

  it('converts $1.00 at SOL=$200 correctly', () => {
    // $1.00 / $200 per SOL = 0.005 SOL = 5,000,000 lamports
    const result = usdToLamports(1.0, 200);
    expect(result).toBe(5_000_000n);
  });

  it('converts $100 at SOL=$100 correctly', () => {
    // $100 / $100 per SOL = 1.0 SOL = 1,000,000,000 lamports
    const result = usdToLamports(100, 100);
    expect(result).toBe(1_000_000_000n);
  });

  it('converts $0.50 at SOL=$200 correctly', () => {
    // $0.50 / $200 = 0.0025 SOL = 2,500,000 lamports
    const result = usdToLamports(0.5, 200);
    expect(result).toBe(2_500_000n);
  });

  it('converts $10 at SOL=$175.50 with rounding', () => {
    // $10 / $175.50 = 0.056980... SOL = 56,980,057 lamports (rounded)
    const result = usdToLamports(10, 175.5);
    // 10 / 175.5 * 1e9 = 56980056.9... → rounds to 56,980,057
    expect(result).toBe(56_980_057n);
  });

  it('converts small amount $0.01 at SOL=$150', () => {
    // $0.01 / $150 = 0.0000666... SOL = 66,667 lamports (rounded from 66666.66...)
    const result = usdToLamports(0.01, 150);
    expect(result).toBe(66_667n);
  });

  it('converts large amount $10,000 at SOL=$300', () => {
    // $10,000 / $300 = 33.333... SOL = 33,333,333,333 lamports (rounded)
    const result = usdToLamports(10_000, 300);
    expect(result).toBe(33_333_333_333n);
  });

  it('handles a realistic SOL price with many decimals', () => {
    // SOL at $142.87 — a realistic market price
    const result = usdToLamports(5, 142.87);
    // 5 / 142.87 * 1e9 = 35,000,350 approximately
    const expected = BigInt(Math.round((5 / 142.87) * 1_000_000_000));
    expect(result).toBe(expected);
  });

  it('returns a bigint (not a number)', () => {
    const result = usdToLamports(1, 100);
    expect(typeof result).toBe('bigint');
  });

  it('throws RangeError for zero amountUSD', () => {
    expect(() => usdToLamports(0, 150)).toThrow(RangeError);
  });

  it('throws RangeError for negative amountUSD', () => {
    expect(() => usdToLamports(-1, 150)).toThrow(RangeError);
  });

  it('throws RangeError for NaN amountUSD', () => {
    expect(() => usdToLamports(Number.NaN, 150)).toThrow(RangeError);
  });

  it('throws RangeError for Infinity amountUSD', () => {
    expect(() => usdToLamports(Infinity, 150)).toThrow(RangeError);
  });

  it('throws RangeError for zero solPriceUSD', () => {
    expect(() => usdToLamports(1, 0)).toThrow(RangeError);
  });

  it('throws RangeError for negative solPriceUSD', () => {
    expect(() => usdToLamports(1, -100)).toThrow(RangeError);
  });

  it('throws RangeError for NaN solPriceUSD', () => {
    expect(() => usdToLamports(1, Number.NaN)).toThrow(RangeError);
  });
});

describe('lamportsToUSD', () => {
  it('converts 10,000,000 lamports at SOL=$150 correctly', () => {
    // 10,000,000 / 1,000,000,000 = 0.01 SOL; 0.01 * $150 = $1.50
    const result = lamportsToUSD(10_000_000n, 150);
    expect(result).toBeCloseTo(1.5, 5);
  });

  it('converts 1,000,000,000 lamports (1 SOL) at any price', () => {
    // 1 SOL at $200 = $200
    const result = lamportsToUSD(1_000_000_000n, 200);
    expect(result).toBeCloseTo(200, 5);
  });

  it('converts 0 lamports to $0', () => {
    const result = lamportsToUSD(0n, 150);
    expect(result).toBe(0);
  });

  it('converts large lamport amount correctly', () => {
    // 33,333,333,333 lamports ≈ 33.333 SOL at $300 = $10,000
    const result = lamportsToUSD(33_333_333_333n, 300);
    expect(result).toBeCloseTo(10_000, 0); // within $1 of $10,000
  });

  it('returns a number (not bigint)', () => {
    const result = lamportsToUSD(1_000_000n, 100);
    expect(typeof result).toBe('number');
  });

  it('throws RangeError for zero solPriceUSD', () => {
    expect(() => lamportsToUSD(1_000_000n, 0)).toThrow(RangeError);
  });

  it('throws RangeError for negative solPriceUSD', () => {
    expect(() => lamportsToUSD(1_000_000n, -100)).toThrow(RangeError);
  });

  it('throws RangeError for NaN solPriceUSD', () => {
    expect(() => lamportsToUSD(1_000_000n, Number.NaN)).toThrow(RangeError);
  });
});

describe('round-trip consistency: usdToLamports → lamportsToUSD', () => {
  it('$1.00 at SOL=$100 round-trips accurately', () => {
    const price = 100;
    const lamports = usdToLamports(1.0, price);
    const backToUSD = lamportsToUSD(lamports, price);
    // Some rounding is expected (lamports are integers), but should be within $0.01
    expect(backToUSD).toBeCloseTo(1.0, 2);
  });

  it('$5.00 at SOL=$150 round-trips accurately', () => {
    const price = 150;
    const lamports = usdToLamports(5.0, price);
    const backToUSD = lamportsToUSD(lamports, price);
    expect(backToUSD).toBeCloseTo(5.0, 2);
  });

  it('$0.99 at SOL=$200 round-trips accurately', () => {
    const price = 200;
    const lamports = usdToLamports(0.99, price);
    const backToUSD = lamportsToUSD(lamports, price);
    expect(backToUSD).toBeCloseTo(0.99, 2);
  });
});

describe('usdToSOL', () => {
  it('converts $100 at SOL=$200 to 0.5 SOL', () => {
    expect(usdToSOL(100, 200)).toBeCloseTo(0.5, 10);
  });

  it('converts $150 at SOL=$150 to 1 SOL', () => {
    expect(usdToSOL(150, 150)).toBeCloseTo(1.0, 10);
  });

  it('throws RangeError for zero amountUSD', () => {
    expect(() => usdToSOL(0, 150)).toThrow(RangeError);
  });

  it('throws RangeError for zero solPriceUSD', () => {
    expect(() => usdToSOL(100, 0)).toThrow(RangeError);
  });
});
