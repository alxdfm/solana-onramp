/**
 * @file url-signer.ts
 * @description Helper for requesting MoonPay URL signatures from a backend endpoint.
 *
 * ## Why URL signing is required
 *
 * When you pass a `walletAddress` to the MoonPay widget, MoonPay requires the widget
 * URL to be signed with an HMAC-SHA256 signature using your MoonPay secret key.
 * This prevents malicious users from modifying the URL to change the wallet address
 * (which would redirect the purchased crypto to an attacker's wallet).
 *
 * ## Security model
 *
 * The signing MUST happen on your backend — never in the browser — because it requires
 * your MoonPay secret key, which must never be exposed to the client.
 *
 * Flow:
 * 1. Frontend builds the widget URL (unsigned)
 * 2. Frontend sends the URL to your backend: `POST /api/sign-moonpay-url`
 * 3. Backend computes HMAC-SHA256(url, secretKey) and returns the signature
 * 4. Frontend passes the signature to the MoonPay SDK via `onUrlSignatureRequested`
 *
 * ## Backend implementation example
 *
 * ```ts
 * // Your backend (Node.js)
 * import crypto from 'crypto';
 *
 * app.post('/api/sign-moonpay-url', (req, res) => {
 *   const { url } = req.body;
 *   const signature = crypto
 *     .createHmac('sha256', process.env.MOONPAY_SECRET_KEY)
 *     .update(new URL(url).search)
 *     .digest('base64');
 *   res.json({ signature });
 * });
 * ```
 */

import { OnrampError } from '@callydus/onramp-core';

/**
 * The expected response shape from the URL signer backend endpoint.
 */
interface UrlSignerResponse {
  /** The HMAC-SHA256 signature of the MoonPay widget URL, base64-encoded. */
  signature: string;
}

/**
 * Requests a URL signature from your backend endpoint.
 *
 * This function is called automatically by the MoonPay SDK's `onUrlSignatureRequested`
 * handler when the widget is opened with a `walletAddress` parameter.
 *
 * @param url - The unsigned MoonPay widget URL that needs to be signed.
 * @param signerEndpoint - The URL of your backend signing endpoint.
 * @returns The HMAC-SHA256 signature string, ready to return to the MoonPay SDK.
 * @throws {OnrampError} If the signing request fails or returns an invalid response.
 *
 * @example
 * ```ts
 * // Used inside MoonPay's onUrlSignatureRequested handler:
 * handlers: {
 *   async onUrlSignatureRequested(props) {
 *     const signature = await requestUrlSignature(props.url, '/api/sign-moonpay-url');
 *     return { signature };
 *   }
 * }
 * ```
 */
export async function requestUrlSignature(
  url: string,
  signerEndpoint: string,
): Promise<string> {
  let response: Response;

  try {
    response = await fetch(signerEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch (err) {
    throw new OnrampError(
      `Failed to reach URL signer endpoint at ${signerEndpoint}: ${err instanceof Error ? err.message : String(err)}`,
      'URL_SIGNER_UNREACHABLE',
      err,
    );
  }

  if (!response.ok) {
    throw new OnrampError(
      `URL signer endpoint returned HTTP ${response.status} ${response.statusText}`,
      'URL_SIGNER_HTTP_ERROR',
    );
  }

  let body: UrlSignerResponse;
  try {
    body = (await response.json()) as UrlSignerResponse;
  } catch (err) {
    throw new OnrampError(
      'URL signer endpoint returned invalid JSON',
      'URL_SIGNER_INVALID_RESPONSE',
      err,
    );
  }

  if (!body.signature || typeof body.signature !== 'string') {
    throw new OnrampError(
      'URL signer endpoint response missing "signature" field',
      'URL_SIGNER_MISSING_SIGNATURE',
    );
  }

  return body.signature;
}
