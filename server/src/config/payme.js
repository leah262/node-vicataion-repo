/**
 * PayMe configuration (server-side only).
 *
 * Never import this module from client-side code or expose values to the browser.
 *
 * Variable guide (adjust after you read PayMe's official docs — names may differ):
 * - PAYME_API_KEY: Often used as a public/server API key for REST calls. Remove if PayMe uses only Basic auth or a single secret.
 * - PAYME_SECRET: Shared secret for signing requests or HMAC. Remove if PayMe does not use request signing.
 * - PAYME_MERCHANT_ID: Your merchant / seller id in PayMe's system.
 * - PAYME_BASE_URL: REST API base (sandbox vs production). No trailing slash.
 * - PAYME_WEBHOOK_SECRET: Separate secret to verify webhook signatures. If PayMe signs with PAYME_SECRET only, you can remove this and use PAYME_SECRET in verification (documented in paymeService).
 */

/**
 * @returns {{ baseUrl: string, apiKey: string | undefined, secret: string | undefined, merchantId: string | undefined, webhookSecret: string | undefined }}
 */
export function getPayMeConfig() {
  const baseUrl = String(process.env.PAYME_BASE_URL || '').trim().replace(/\/+$/, '');
  return {
    baseUrl,
    apiKey: optionalTrim(process.env.PAYME_API_KEY),
    secret: optionalTrim(process.env.PAYME_SECRET),
    merchantId: optionalTrim(process.env.PAYME_MERCHANT_ID),
    webhookSecret: optionalTrim(process.env.PAYME_WEBHOOK_SECRET),
  };
}

function optionalTrim(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

/**
 * Non-secret status for health checks / ops (never returns key material).
 */
export function getPayMeEnvStatus() {
  const c = getPayMeConfig();
  return {
    configured: Boolean(c.baseUrl && c.merchantId && (c.apiKey || c.secret)),
    hasBaseUrl: Boolean(c.baseUrl),
    hasMerchantId: Boolean(c.merchantId),
    hasApiKey: Boolean(c.apiKey),
    hasSecret: Boolean(c.secret),
    hasWebhookSecret: Boolean(c.webhookSecret),
  };
}

/**
 * Throws if PayMe is not minimally configured for outbound API calls.
 * TODO: Tighten required fields once you confirm PayMe's auth scheme.
 */
export function assertPayMeConfiguredForApi() {
  const c = getPayMeConfig();
  if (!c.baseUrl) {
    const err = new Error('PAYME_BASE_URL is not configured');
    err.code = 'PAYME_CONFIG';
    throw err;
  }
  if (!c.merchantId) {
    const err = new Error('PAYME_MERCHANT_ID is not configured');
    err.code = 'PAYME_CONFIG';
    throw err;
  }
  // Many gateways need at least one credential; keep flexible until docs are wired.
  if (!c.apiKey && !c.secret) {
    const err = new Error('PayMe credentials missing: set PAYME_API_KEY and/or PAYME_SECRET per PayMe docs');
    err.code = 'PAYME_CONFIG';
    throw err;
  }
}
