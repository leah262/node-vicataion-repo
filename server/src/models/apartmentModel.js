import pool from '../config/db.js';
import { mapApartmentRow } from '../utils/mapApartment.js';

export async function attachImagesToApartments(rows) {
  if (!rows || rows.length === 0) return [];
  const ids = [
    ...new Set(
      rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  if (ids.length === 0) return rows.map((row) => mapApartmentRow(row, []));

  const placeholders = ids.map(() => '?').join(',');
  const [imageRows] = await pool.query(
    `SELECT apartment_id, image_url, sort_order
     FROM apartment_images
     WHERE apartment_id IN (${placeholders})
     ORDER BY apartment_id ASC, sort_order ASC, id ASC`,
    ids,
  );
  const byApt = new Map();
  for (const ir of imageRows) {
    const aid = Number(ir.apartment_id);
    if (!byApt.has(aid)) byApt.set(aid, []);
    byApt.get(aid).push(ir.image_url);
  }
  return rows.map((row) => mapApartmentRow(row, byApt.get(Number(row.id)) || []));
}

export async function attachImagesToApartment(row) {
  if (!row) return null;
  const [imageRows] = await pool.query(
    `SELECT image_url FROM apartment_images
     WHERE apartment_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [row.id],
  );
  return mapApartmentRow(
    row,
    imageRows.map((r) => r.image_url),
  );
}

export async function selectApprovedApartments() {
  const [rows] = await pool.query(
    `SELECT * FROM apartments
     WHERE status = 'approved'
     ORDER BY id ASC`,
  );
  return rows;
}

export async function selectMineApartments(userId, emailLower) {
  const [rows] = await pool.query(
    `SELECT * FROM apartments
     WHERE owner_id = ?
        OR (
          owner_id IS NULL
          AND owner_email IS NOT NULL
          AND TRIM(owner_email) <> ''
          AND LOWER(TRIM(owner_email)) = ?
        )
     ORDER BY id DESC`,
    [userId, emailLower || null],
  );
  return rows;
}

export async function selectPendingApartments() {
  const [rows] = await pool.query(
    "SELECT * FROM apartments WHERE status = 'pending' ORDER BY created_at ASC",
  );
  return rows;
}

export async function selectApartmentById(id) {
  const [rows] = await pool.query('SELECT * FROM apartments WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function insertApartmentPending({
  owner_id,
  title,
  description,
  location,
  address,
  property_type,
  rental_period,
  price_per_night,
  bedrooms,
  bathrooms,
  max_guests,
  image_url,
  owner_name,
  owner_phone,
  owner_email,
  contact_via_whatsapp,
  is_available,
}) {
  const [result] = await pool.query(
    `INSERT INTO apartments
      (owner_id, title, description, location, address, property_type, rental_period,
       price_per_night, bedrooms, bathrooms, max_guests, rating, image_url,
       owner_name, owner_phone, owner_email, contact_via_whatsapp,
       is_available, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      owner_id,
      title,
      description || null,
      location,
      address || null,
      property_type || 'דירה',
      rental_period || 'כל השנה',
      Number(price_per_night),
      Number(bedrooms) || 1,
      Number(bathrooms) || 1,
      Number(max_guests) || 2,
      4.5,
      image_url,
      owner_name || null,
      owner_phone || null,
      owner_email || null,
      contact_via_whatsapp ? 1 : 0,
      is_available === false ? 0 : 1,
    ],
  );
  return result.insertId;
}

export async function insertApartmentImagesRows(values) {
  if (!values.length) return;
  await pool.query(
    'INSERT INTO apartment_images (apartment_id, image_url, sort_order) VALUES ?',
    [values],
  );
}

export async function deleteApartmentImages(apartmentId) {
  await pool.query('DELETE FROM apartment_images WHERE apartment_id = ?', [apartmentId]);
}

export async function updateApartmentDynamic(updatesSql, values) {
  if (!updatesSql.length) return;
  await pool.query(`UPDATE apartments SET ${updatesSql.join(', ')} WHERE id = ?`, values);
}

export async function deleteApartmentById(id) {
  await pool.query('DELETE FROM apartments WHERE id = ?', [id]);
}

export async function apartmentExists(id) {
  const [check] = await pool.query('SELECT id FROM apartments WHERE id = ?', [id]);
  return check.length > 0;
}

export async function approveApartmentRow(id) {
  await pool.query(
    `UPDATE apartments
     SET status = 'approved', approved_at = CURRENT_TIMESTAMP, rejection_reason = NULL
     WHERE id = ?`,
    [id],
  );
}

export async function rejectApartmentRow(id, reason) {
  await pool.query(
    `UPDATE apartments
     SET status = 'rejected', rejection_reason = ?, approved_at = NULL
     WHERE id = ?`,
    [reason, id],
  );
}

export async function updateApartmentExpiryFromPayment({ apartmentId, periodEnd, wasExpired }) {
  if (wasExpired) {
    await pool.query(
      `UPDATE apartments
       SET expires_at = ?, expiry_reminder_sent = 0, status = 'approved', approved_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [periodEnd, apartmentId],
    );
  } else {
    await pool.query('UPDATE apartments SET expires_at = ?, expiry_reminder_sent = 0 WHERE id = ?', [
      periodEnd,
      apartmentId,
    ]);
  }
}

/** תזכורות תוקף — שליפת מודעות לפי שלב וטווח ימים */
export async function selectReminderTargets(withinDays, currentStage) {
  const [rows] = await pool.query(
    `SELECT a.*, u.email AS user_email, u.full_name AS user_full_name
     FROM apartments a
     LEFT JOIN users u ON u.id = a.owner_id
     WHERE a.status = 'approved'
       AND a.expiry_reminder_sent = ?
       AND a.expires_at IS NOT NULL
       AND a.expires_at > NOW()
       AND a.expires_at <= (NOW() + INTERVAL ? DAY)`,
    [currentStage, withinDays],
  );
  return rows;
}

export async function setExpiryReminderSent(apartmentId, stageValue) {
  await pool.query('UPDATE apartments SET expiry_reminder_sent = ? WHERE id = ?', [
    stageValue,
    apartmentId,
  ]);
}

export async function suspendExpiredApartments() {
  const [result] = await pool.query(
    `UPDATE apartments
     SET status = 'expired'
     WHERE status = 'approved'
       AND expires_at IS NOT NULL
       AND expires_at <= NOW()`,
  );
  return result.affectedRows || 0;
}
