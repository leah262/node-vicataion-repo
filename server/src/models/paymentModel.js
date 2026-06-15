import pool from '../config/db.js';

export async function insertPendingPayment(userId, amount, currency) {
  const [ins] = await pool.query(
    `INSERT INTO payments (user_id, payme_transaction_id, amount, currency, status)
     VALUES (?, NULL, ?, ?, 'pending')`,
    [userId, amount, currency],
  );
  return ins.insertId;
}

export async function updatePaymentPaymeTransaction(paymentId, userId, paymeTransactionId) {
  await pool.query(
    `UPDATE payments
     SET payme_transaction_id = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [paymeTransactionId, paymentId, userId],
  );
}

export async function markPaymentFailed(paymentId, userId) {
  await pool.query(
    `UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
    [paymentId, userId],
  );
}

export async function selectPaymentById(paymentId) {
  const [rows] = await pool.query(
    `SELECT id, user_id, payme_transaction_id, amount, currency, status, created_at, updated_at
     FROM payments WHERE id = ?`,
    [paymentId],
  );
  return rows[0] || null;
}

export async function updatePaymentStatusById(paymentId, status) {
  await pool.query(
    `UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, paymentId],
  );
}

export async function updatePaymentStatusByPaymeTransactionId(localStatus, paymeTransactionId) {
  const [result] = await pool.query(
    `UPDATE payments
     SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE payme_transaction_id = ?`,
    [localStatus, paymeTransactionId],
  );
  return result.affectedRows || 0;
}
