# CONTEXT.md — @callydus/onramp-adapter-transak

## Status: NOT IMPLEMENTED

This package is a stub. All methods throw `NotImplementedError` at runtime.

## What this package will do (when implemented)

Implement the `OnrampAdapter` interface from `@callydus/onramp-core` using the
[Transak JavaScript SDK](https://docs.transak.com/docs/transak-one-javascript-sdk).

Transak is an alternative to MoonPay with:
- Coverage in 150+ countries
- Strong local payment method support in Latin America, Southeast Asia, and Africa
- PIX support for Brazil
- Lower fees in some markets

## How to implement

1. Install the SDK:
   ```
   pnpm add @transak/transak-sdk
   ```

2. Create `src/config.ts` with a Zod validation schema similar to `adapter-moonpay/config.ts`

3. Replace the `NotImplementedError` stubs in `src/adapter.ts` with real SDK calls

4. Create `src/__tests__/adapter.test.ts` following the MoonPay test patterns

5. Update this CONTEXT.md to reflect the implemented status

6. Update the root README.md example section

## Key differences from MoonPay

- Transak uses a different widget initialization API
- Transak has a different event system for transaction completion
- URL signing works differently (check Transak docs)

## Internal structure (when implemented)

```
src/
├── config.ts       # Zod schema for TransakAdapterConfig
├── adapter.ts      # TransakAdapter class
└── index.ts        # Public re-exports
```
