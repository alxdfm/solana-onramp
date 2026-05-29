# CONTEXT.md — @callydus/onramp-adapter-moonpay

## What this package does

Implements the `OnrampAdapter` interface from `@callydus/onramp-core` using the
[MoonPay JavaScript SDK](https://docs.moonpay.com/moonpay/implementation-guide/on-ramp/web-sdk).

MoonPay is a regulated fiat-to-crypto on-ramp provider that handles KYC, payment processing,
and compliance. This adapter wraps their SDK and normalizes it to the generic `TopupParams`/`TopupResult`
contract, so the rest of the application has no knowledge of MoonPay's specific API.

## When to use this package

Use this when:
- You want to accept credit/debit card, PIX, bank transfer, or other fiat payment methods
- You need KYC-compliant purchases
- Your users are in MoonPay's [supported countries](https://support.moonpay.com/customers/docs/moonpay-supported-countries)

## Internal structure

```
src/
├── config.ts       # Zod schema for MoonPayAdapterConfig + isSandboxKey() helper
├── url-signer.ts   # requestUrlSignature() — calls backend to sign MoonPay widget URLs
├── adapter.ts      # MoonPayAdapter class — main implementation
└── index.ts        # Public re-exports
```

## URL signing

MoonPay requires HMAC-SHA256 URL signing when `walletAddress` is set. This prevents users
from altering the URL to change the destination wallet. The signing MUST happen on your
backend (never the browser) because it requires your MoonPay secret key.

Configure the `urlSignerEndpoint` in `MoonPayAdapterConfig` to point to your backend.
Your backend must implement:
```
POST /api/sign-moonpay-url
Body: { url: string }
Response: { signature: string }
```

## Environment detection

MoonPay automatically determines sandbox vs production from the API key prefix:
- `pk_test_...` → sandbox (test cards, no real money)
- `pk_live_...` → production (real money, real KYC)

## Dependencies

- `@moonpay/moonpay-js` — MoonPay's official JavaScript SDK
- `@callydus/onramp-core` — for the OnrampAdapter interface and error classes
