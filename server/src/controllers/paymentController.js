import {
  insertPendingPayment,
  markPaymentFailed,
  selectPaymentById,
  updatePaymentPaymeTransaction,
  updatePaymentStatusById,
  updatePaymentStatusByPaymeTransactionId,
} from '../models/paymentModel.js';
import { logger } from '../utils/logger.js';
import { HttpError } from '../utils/HttpError.js';
import {
  createPayment as paymeCreatePayment,
  getPaymentStatus as paymeGetRemoteStatus,
  handleWebhook as paymeHandleWebhook,
  mapRemoteStatusToLocal,
  normalizePayMeError,
  verifyPayment as paymeVerifyPayment,
} from '../services/paymeService.js';

function appBaseUrl() {
  const raw = String(process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return raw;
}

export async function createPayMePayment(req, res) {
  const userId = req.user.id;
  const { amount, currency, description, metadata } = req.paymeCreate;

  const returnUrl =
    String(req.body?.return_url || '').trim() ||
    `${appBaseUrl()}/pay/success?provider=payme`;
  const cancelUrl =
    String(req.body?.cancel_url || '').trim() || `${appBaseUrl()}/pay/failed?provider=payme`;

  if (!/^https?:\/\//i.test(returnUrl) || !/^https?:\/\//i.test(cancelUrl)) {
    return res.status(400).json({ error: 'return_url and cancel_url must be http(s) URLs' });
  }

  const paymentId = await insertPendingPayment(userId, amount, currency);
  const idempotencyKey = `pay-${paymentId}-${userId}`;

  try {
    const remote = await paymeCreatePayment({
      amount,
      currency,
      description: description || `Payment #${paymentId}`,
      returnUrl: appendQuery(returnUrl, { paymentId }),
      cancelUrl: appendQuery(cancelUrl, { paymentId }),
      idempotencyKey,
      metadata: { ...metadata, internal_payment_id: paymentId, user_id: userId },
    });

    await updatePaymentPaymeTransaction(paymentId, userId, remote.paymeTransactionId);

    return res.status(201).json({
      paymentId,
      checkoutUrl: remote.checkoutUrl,
      paymeTransactionId: remote.paymeTransactionId,
      status: 'pending',
    });
  } catch (error) {
    await markPaymentFailed(paymentId, userId).catch(() => {});
    const norm = normalizePayMeError(error, 'create');
    throw new HttpError(norm.status, norm.message, norm.code);
  }
}

function appendQuery(url, params) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export async function getPayMePaymentStatus(req, res) {
  const userId = req.user.id;
  const paymentId = Number(req.params.id);
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    return res.status(400).json({ error: 'Invalid payment id' });
  }

  const row = await selectPaymentById(paymentId);
  if (!row) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  if (row.user_id !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const sync = String(req.query.sync || '') === '1' || String(req.query.sync || '') === 'true';
  if (sync && row.payme_transaction_id) {
    try {
      const remote = await paymeGetRemoteStatus(row.payme_transaction_id);
      const remoteStatus =
        remote?.status || remote?.payment_status || remote?.state || remote?.data?.status;
      if (remoteStatus) {
        const local = mapRemoteStatusToLocal(String(remoteStatus));
        await updatePaymentStatusById(paymentId, local);
        row.status = local;
      }
    } catch {
      /* best-effort sync */
    }
  }

  return res.json({
    id: row.id,
    paymeTransactionId: row.payme_transaction_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function handlePayMeWebhookRequest(req, res) {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const verified = paymeHandleWebhook(rawBody, req.headers);
  if (!verified.ok) {
    return res.status(400).json({ error: verified.reason });
  }

  const localStatus = mapRemoteStatusToLocal(verified.status);

  const updated = await updatePaymentStatusByPaymeTransactionId(localStatus, verified.transactionId);

  if (!updated) {
    logger.warn(
      `[PayMe webhook] No local row matched payme_transaction_id=${verified.transactionId}. Check transaction id mapping / migration.`,
    );
  }

  return res.status(200).json({ ok: true, updated });
}

export async function verifyPayMeRemoteTransaction(paymeTransactionId) {
  return paymeVerifyPayment(paymeTransactionId);
}
