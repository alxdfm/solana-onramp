# CONTEXT.md — @callydus/onramp-react

## What this package does

Provides React context and hooks that bridge the `OnrampClient` from `@callydus/onramp-core`
with React's state management model.

Without this package, you'd need to:
- Manage `isLoading`, `error`, and result state manually in every component
- Pass the client instance through props or create your own context
- Handle async operations in event handlers without proper cleanup

This package handles all of that with two hooks and a Provider component.

## When to use this package

Use `@callydus/onramp-react` when:
- Your application uses React (React 18+)
- You want to trigger onramp flows from React components
- You want to display fee estimates in the UI
- You want loading/error state managed automatically

Skip this package if you're working in a non-React environment (Node.js backend, Vue, etc.)
and use `@callydus/onramp-core` directly instead.

## Internal structure

```
src/
├── OnrampContext.tsx   # React context + OnrampProvider component
├── useOnramp.ts        # Hook for triggering fiat-to-SOL purchases
├── useFee.ts           # Hook for fee estimation and collection
└── index.ts            # Public re-exports
```

## Setup

1. Create a client at the app root:
   ```ts
   // Outside the component — stable reference
   const client = createOnrampClient({ ... });
   ```

2. Wrap your app with the provider:
   ```tsx
   <OnrampProvider client={client}>
     <App />
   </OnrampProvider>
   ```

3. Use hooks in child components:
   ```tsx
   const { topup, isLoading } = useOnramp();
   const { estimateFeeInSOL, solPrice } = useFee();
   ```

## Dependencies

- `react` — peer dependency (^18.0.0)
- `@callydus/onramp-core` — for the `OnrampClient` and types
