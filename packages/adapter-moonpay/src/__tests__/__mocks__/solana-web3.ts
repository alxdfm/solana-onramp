/**
 * Minimal mock for @solana/web3.js to avoid CJS/ESM interop issues in tests.
 * MoonPay adapter tests don't use Solana directly.
 */
export const SystemProgram = { transfer: () => ({}) };
export const Transaction = class { add() { return this; } };
export const sendAndConfirmTransaction = async () => 'mock-signature';
export const PublicKey = class { constructor(public value: string) {} toBase58() { return this.value; } };
export const Connection = class {};
