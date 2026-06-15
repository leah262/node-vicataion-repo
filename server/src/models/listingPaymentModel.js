import pool from '../config/db.js';

export async function selectApartmentByIdForListing(id) {
  const [rows] = await pool.query('SELECT * FROM apartments WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function insertListingPaymentRow(params) {
  const [result] = await pool.query(
    `INSERT INTO listing_payments
      (apartment_id, user_id, amount, currency, months, status, provider, provider_reference,
       paid_at, period_start, period_end)
     VALUES (?, ?, ?, 'ILS', ?, 'paid', ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
    params,
  );
  return result.insertId;
}

export async function selectListingPaymentById(id) {
  const [payRows] = await pool.query('SELECT * FROM listing_payments WHERE id = ?', [id]);
  return payRows[0] || null;
}

export async function selectMineListingPayments(userId) {
  const [rows] = await pool.query(
    `SELECT lp.*, a.title AS apartment_title
     FROM listing_payments lp
     LEFT JOIN apartments a ON a.id = lp.apartment_id
     WHERE lp.user_id = ?
     ORDER BY lp.created_at DESC`,
    [userId],
  );
  return rows;
}

export async function selectAllListingPaymentsAdmin() {
  const [rows] = await pool.query(
    `SELECT lp.*, a.title AS apartment_title, u.email AS user_email
     FROM listing_payments lp
     LEFT JOIN apartments a ON a.id = lp.apartment_id
     LEFT JOIN users u ON u.id = lp.user_id
     ORDER BY lp.created_at DESC`,
  );
  return rows;
}
