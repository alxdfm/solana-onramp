/**
 * @file index.ts
 * @description Public API for the @callydus/onramp-react package.
 *
 * ## Usage
 * ```tsx
 * import { OnrampProvider, useOnramp, useFee } from '@callydus/onramp-react';
 * ```
 */

// Context and Provider
export { OnrampContext, OnrampProvider } from './OnrampContext.js';
export type { OnrampProviderProps } from './OnrampContext.js';

// Hooks
export { useOnramp } from './useOnramp.js';
export type { UseOnrampReturn } from './useOnramp.js';

export { useFee } from './useFee.js';
export type { UseFeeReturn } from './useFee.js';
