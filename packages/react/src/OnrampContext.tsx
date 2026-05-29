/**
 * @file OnrampContext.tsx
 * @description React Context and Provider for the OnrampClient.
 *
 * This file provides two things:
 * 1. `OnrampContext` — the React context that stores the `OnrampClient` instance
 * 2. `OnrampProvider` — the context provider component that wraps your app
 *
 * ## Why use a Context?
 *
 * The `OnrampClient` is a stateful object that holds references to adapter instances.
 * Creating it once (at the root of your component tree) and sharing it via context
 * means every component can access the same client without prop drilling.
 *
 * ## Usage
 *
 * Wrap your application (or the part that needs onramp) with `OnrampProvider`:
 *
 * ```tsx
 * import { OnrampProvider } from '@callydus/onramp-react';
 * import { createOnrampClient } from '@callydus/onramp-core';
 * import { MoonPayAdapter } from '@callydus/onramp-adapter-moonpay';
 * import { PythOracleAdapter } from '@callydus/onramp-oracle-pyth';
 *
 * const client = createOnrampClient({
 *   onrampAdapter: new MoonPayAdapter({ apiKey: process.env.NEXT_PUBLIC_MOONPAY_KEY }),
 *   oracleAdapter: new PythOracleAdapter({ cluster: 'pythnet' }),
 *   network: 'mainnet-beta',
 * });
 *
 * function App() {
 *   return (
 *     <OnrampProvider client={client}>
 *       <YourApp />
 *     </OnrampProvider>
 *   );
 * }
 * ```
 *
 * Then consume the client in child components via `useOnramp()` or `useFee()`.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { OnrampClient } from '@callydus/onramp-core';

// ─── Context ───────────────────────────────────────────────────────────────────

/**
 * The OnrampContext stores the `OnrampClient` instance.
 *
 * The default value is `null` — accessing the context outside of an
 * `OnrampProvider` will return `null`, which the hooks handle by throwing
 * a descriptive error.
 */
export const OnrampContext = createContext<OnrampClient | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

/**
 * Props for the `OnrampProvider` component.
 */
export interface OnrampProviderProps {
  /**
   * The `OnrampClient` instance to provide to child components.
   * Create this once outside the component tree using `createOnrampClient()`.
   */
  client: OnrampClient;

  /** Child components that will have access to the OnrampContext. */
  children: ReactNode;
}

/**
 * Context provider that makes an `OnrampClient` available to child components.
 *
 * Place this near the root of your component tree (or anywhere above the components
 * that use `useOnramp()` or `useFee()`).
 *
 * The `client` prop should be a stable reference (created outside the component or
 * memoized) to avoid re-rendering child components on every render.
 *
 * @example
 * ```tsx
 * // In your app root (e.g., _app.tsx in Next.js)
 * const onrampClient = createOnrampClient({ ... }); // created outside component
 *
 * function MyApp({ Component, pageProps }) {
 *   return (
 *     <OnrampProvider client={onrampClient}>
 *       <Component {...pageProps} />
 *     </OnrampProvider>
 *   );
 * }
 * ```
 */
export function OnrampProvider({ client, children }: OnrampProviderProps): ReactNode {
  return <OnrampContext.Provider value={client}>{children}</OnrampContext.Provider>;
}

// ─── Internal hook ─────────────────────────────────────────────────────────────

/**
 * Returns the `OnrampClient` from the context.
 *
 * This is an internal hook used by `useOnramp` and `useFee`. It throws if called
 * outside an `OnrampProvider`, providing a clear error message to developers.
 *
 * @internal
 * @throws {Error} If called outside of an `OnrampProvider`.
 */
export function useOnrampClient(): OnrampClient {
  const client = useContext(OnrampContext);
  if (!client) {
    throw new Error(
      'useOnramp/useFee must be used within an <OnrampProvider>. ' +
        'Wrap your component tree with <OnrampProvider client={...}>.',
    );
  }
  return client;
}
