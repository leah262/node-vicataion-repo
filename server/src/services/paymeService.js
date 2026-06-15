import crypto from 'crypto';
import { assertPayMeConfiguredForApi, getPayMeConfig } from '../config/payme.js';

/**
 * Low-level PayMe HTTP call using Node's built-in `fetch` (Node 18+).
 * Avoids an extra dependency (e.g. axios) so `npm run dev` works even when registry TLS is broken.
 * TODO: Insert actual PayMe API version prefix in paths if required (e.g. `/api/v1`).
 */
async function paymeRequest(path, { method = 'GET', body, headers = {} } = {}) {
  assertPayMeConfiguredForApi();
  const { baseUrl } = getPayMeConfig();
  const base = String(baseUrl).replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${p}`;
  const timeoutMs = Number(process.env.PAYME_HTTP_TIMEOUT_MS) || 20000;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  /** @type {Record<string, string>} */
  const mergedHeaders = { ...headers };
  if (body !== undefined && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(url, {
      method,
      headers: mergedHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
    const text = await res.text();
    let data = /** @type {unknown} */ (text);
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        /* leave as raw string */
      }
    }
    return { status: res.status, data };
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      const e = new Error('PayMe request timed out');
      e.code = 'PAYME_TIMEOUT';
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{ status: number, data: unknown }} responseLike
 */
function throwIfNotOk(responseLike, label) {
  const { status, data } = responseLike;
  if (status >= 200 && status < 300) return;
  const err = new Error(`${label} failed (${status})`);
  err.response = { status, data };
  throw err;
}

/**
 * Map network / PayMe HTTP errors to a stable application error.
 * @param {unknown} error
 * @param {string} context
 */
export function normalizePayMeError(error, context = 'payme') {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'PAYME_CONFIG') {
    return { status: 503, message: String(error.message), code: 'PAYME_CONFIG' };
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === 'PAYME_PARSE') {
    return { status: 502, message: String(error.message), code: 'PAYME_PARSE' };
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === 'PAYME_TIMEOUT') {
    return { status: 504, message: String(error.message), code: 'PAYME_TIMEOUT', context };
  }
  if (error && typeof error === 'object' && 'response' in error && error.response) {
    const r = /** @type {{ status?: number, data?: unknown }} */ (error.response);
    const status = typeof r.status === 'number' ? r.status : 502;
    const body = r.data;
    let msg = `PayMe request failed (${status})`;
    if (typeof body === 'object' && body !== null) {
      const o = /** @type {{ message?: unknown, error?: unknown }} */ (body);
      if (o.message != null) msg = String(o.message);
      else if (o.error != null) msg = String(o.error);
    } else if (typeof body === 'string' && body.trim()) {
      msg = body.trim();
    }
    return {
      status: status >= 400 ? status : 502,
      message: String(msg),
      code: 'PAYME_HTTP',
      context,
    };
  }
  return {
    status: 500,
    message: error instanceof Error ? error.message : 'Unexpected PayMe error',
    code: 'PAYME_UNKNOWN',
    context,
  };
}

/**
 * Build request headers per PayMe documentation.
 * TODO: Insert actual PayMe credential headers (Bearer vs Basic vs custom headers).
 */
function buildAuthHeaders() {
  const { apiKey, secret, merchantId } = getPayMeConfig();
  /** @type {Record<string, string>} */
  const headers = {
    Accept: 'application/json',
  };
  if (merchantId) {
    // TODO: Replace header name with PayMe's real merchant header (if any).
    headers['X-Merchant-Id'] = merchantId;
  }
  if (apiKey) {
    // TODO: Replace with PayMe's expected scheme (Bearer / API-Key / etc.).
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (secret) {
    // TODO: Some providers use secret as Bearer; adjust when docs are known.
    headers.Authorization = `Bearer ${secret}`;
  }
  return headers;
}

/**
 * Create a payment session / charge at PayMe and obtain a redirect URL for the payer.
 *
 * @param {object} input
 * @param {number|string} input.amount
 * @param {string} input.currency
 * @param {string} [input.description]
 * @param {string} input.returnUrl
 * @param {string} input.cancelUrl
 * @param {string} [input.idempotencyKey]
 * @returns {Promise<{ paymeTransactionId: string, checkoutUrl: string, raw: unknown }>}
 */
export async function createPayment(input) {
  const { merchantId } = getPayMeConfig();

  // TODO: Insert actual PayMe API endpoint path (create session / payment / sale).
  const path = process.env.PAYME_CREATE_PAYMENT_PATH || '/payments';

  const payload = {
    // TODO: Align field names with PayMe's request schema (amount units: major vs minor currency).
    merchant_id: merchantId,
    amount: Number(input.amount),
    currency: String(input.currency || 'ILS').toUpperCase(),
    description: input.description,
    success_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    metadata: input.metadata || undefined,
  };

  const headers = {
    ...buildAuthHeaders(),
    'Content-Type': 'application/json',
    ...(input.idempotencyKey
      ? {
          // TODO: Insert actual PayMe idempotency header name.
          'Idempotency-Key': input.idempotencyKey,
        }
      : {}),
  };

  try {
    const res = await paymeRequest(path, { method: 'POST', body: payload, headers });
    throwIfNotOk(res, 'PayMe create');
    const data = res.data;

    // TODO: Insert actual PayMe response parsing (transaction id + checkout URL fields).
    const paymeTransactionId =
      data?.transaction_id || data?.id || data?.payment_id || data?.data?.id;
    const checkoutUrl =
      data?.payment_url || data?.checkout_url || data?.redirect_url || data?.url;

    if (!paymeTransactionId || !checkoutUrl) {
      const err = new Error(
        'PayMe response missing transaction id or checkout URL — update paymeService parsing after confirming docs',
      );
      err.code = 'PAYME_PARSE';
      throw err;
    }

    return {
      paymeTransactionId: String(paymeTransactionId),
      checkoutUrl: String(checkoutUrl),
      raw: data,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'response' in error && error.response) {
      const r = /** @type {{ status: number, data: unknown }} */ (error.response);
      const e = new Error(`PayMe create failed (${r.status})`);
      e.response = r;
      throw e;
    }
    throw error;
  }
}

/**
 * Verify a payment with PayMe (server-to-server), e.g. after redirect back to your site.
 * @param {string} paymeTransactionId
 */
export async function verifyPayment(paymeTransactionId) {
  // TODO: Insert actual PayMe verify/capture endpoint.
  const pathTemplate = process.env.PAYME_VERIFY_PAYMENT_PATH || '/payments/:id/verify';
  const path = pathTemplate.replace(':id', encodeURIComponent(paymeTransactionId));

  const headers = { ...buildAuthHeaders(), 'Content-Type': 'application/json' };
  const res = await paymeRequest(path, { method: 'POST', body: {}, headers });
  throwIfNotOk(res, 'PayMe verify');
  return res.data;
}

/**
 * Fetch current payment status from PayMe.
 * @param {string} paymeTransactionId
 */
export async function getPaymentStatus(paymeTransactionId) {
  // TODO: Insert actual PayMe status endpoint.
  const pathTemplate = process.env.PAYME_GET_STATUS_PATH || '/payments/:id';
  const path = pathTemplate.replace(':id', encodeURIComponent(paymeTransactionId));

  const res = await paymeRequest(path, { method: 'GET', headers: buildAuthHeaders() });
  throwIfNotOk(res, 'PayMe status');
  return res.data;
}

/**
 * Verify webhook authenticity and parse a normalized event.
 *
 * @param {Buffer} rawBody
 * @param {import('http').IncomingHttpHeaders} headers
 * @returns {{ ok: true, transactionId: string, status: string, raw: unknown } | { ok: false, reason: string }}
 */
export function handleWebhook(rawBody, headers) {
  const cfg = getPayMeConfig();

  // TODO: Insert actual PayMe webhook validation logic (signature header name, algorithm, encoding).
  // Common patterns:
  // - HMAC-SHA256 of raw body using PAYME_WEBHOOK_SECRET (or PAYME_SECRET)
  // - RSA signature verification using PayMe public key
  // - Timestamp + signed payload (replay protection)

  const secret = cfg.webhookSecret || cfg.secret;
  if (!secret) {
    return { ok: false, reason: 'Webhook secret not configured (PAYME_WEBHOOK_SECRET or PAYME_SECRET)' };
  }

  // TODO: Replace with PayMe's real signature header(s).
  const providedSig =
    (headers['x-payme-signature'] ||
      headers['x-signature'] ||
      headers['payme-signature']) ??
    '';

  if (!providedSig || Array.isArray(providedSig)) {
    return { ok: false, reason: 'Missing webhook signature header' };
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  // TODO: PayMe may use base64 / prefix format (e.g. `sha256=...`) — adjust comparison accordingly.
  const a = String(providedSig).trim();
  const b = expected;
  try {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length || !crypto.timingSafeEqual(ba, bb)) {
      return { ok: false, reason: 'Invalid webhook signature' };
    }
  } catch {
    return { ok: false, reason: 'Invalid webhook signature' };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody.toString('utf8') || '{}');
  } catch {
    return { ok: false, reason: 'Invalid JSON webhook body' };
  }

  // TODO: Insert actual PayMe webhook payload parsing (event type, ids, status).
  const transactionId =
    parsed?.transaction_id || parsed?.payment_id || parsed?.id || parsed?.data?.id;
  const status = parsed?.status || parsed?.payment_status || parsed?.state;

  if (!transactionId || !status) {
    return { ok: false, reason: 'Webhook payload missing transaction id or status' };
  }

  return {
    ok: true,
    transactionId: String(transactionId),
    status: String(status).toLowerCase(),
    raw: parsed,
  };
}

/**
 * Map PayMe remote status strings to our DB ENUM-like strings.
 * TODO: Align with PayMe's canonical status values.
 * @param {string} remoteStatus
 */
export function mapRemoteStatusToLocal(remoteStatus) {
  const s = String(remoteStatus || '').toLowerCase();
  if (['paid', 'completed', 'success', 'captured', 'approved'].includes(s)) return 'paid';
  if (['pending', 'processing', 'created', 'initialized'].includes(s)) return 'pending';
  if (['failed', 'declined', 'error', 'canceled', 'cancelled', 'voided'].includes(s)) return 'failed';
  if (['refunded', 'partially_refunded'].includes(s)) return 'refunded';
  return 'pending';
}
