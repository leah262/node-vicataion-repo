import { paypalCreateOrder, paypalCaptureOrder } from '../services/paypalRest.js';
import { HttpError } from '../utils/HttpError.js';

const ALLOWED_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'ILS']);

function normalizeAmount(body) {
  const currency = String(body?.currency_code || 'USD')
    .toUpperCase()
    .trim();
  if (!ALLOWED_CURRENCIES.has(currency)) {
    throw new HttpError(400, `Unsupported currency_code (allowed: ${[...ALLOWED_CURRENCIES].join(', ')})`);
  }
  const raw = body?.value ?? body?.amount;
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 50_000) {
    throw new HttpError(400, 'Invalid amount (must be a positive number, max 50000)');
  }
  const value = n.toFixed(2);
  return { currency_code: currency, value };
}

export async function createOrder(req, res) {
  const amount = normalizeAmount(req.body || {});
  const order = await paypalCreateOrder(amount);
  if (!order?.id) {
    throw new HttpError(502, 'PayPal did not return an order id');
  }
  res.status(201).json({ id: order.id, status: order.status });
}

export async function captureOrder(req, res) {
  const orderID = String(req.params.orderID || '').trim();
  if (!orderID || orderID.length > 128) {
    return res.status(400).json({ error: 'Invalid order id' });
  }
  const result = await paypalCaptureOrder(orderID);
  res.json(result);
}
