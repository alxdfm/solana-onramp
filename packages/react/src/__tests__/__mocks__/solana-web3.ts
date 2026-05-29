/**
 * Minimal mock for @solana/web3.js to avoid CJS/ESM interop issues in tests.
 */
export const SystemProgram = { transfer: () => ({}) };
export const Transaction = class { add() { return this; } };
export const sendAndConfirmTransaction = async () => 'mock-signature';
export class PublicKey { constructor(public value: string) {} toBase58() { return this.value; } }
export const Connection = class {};
