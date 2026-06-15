import pool from '../config/db.js';

export async function findUserIdByEmail(email) {
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  return rows[0] || null;
}

export async function findUserByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
}

export async function findUserById(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function insertLocalUser({ full_name, email, phone, password_hash }) {
  const [result] = await pool.query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, email_verified, auth_provider)
     VALUES (?, ?, ?, ?, 'owner', 0, 'local')`,
    [full_name.trim(), email, phone || null, password_hash],
  );
  return result.insertId;
}

export async function setEmailVerified(userId) {
  await pool.query('UPDATE users SET email_verified = 1 WHERE id = ?', [userId]);
}

export async function updatePasswordAndVerify(userId, password_hash) {
  await pool.query('UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?', [
    password_hash,
    userId,
  ]);
}

export async function mergeGoogleUser(googleId, userId) {
  await pool.query(
    `UPDATE users
     SET google_id = COALESCE(google_id, ?),
         email_verified = 1,
         auth_provider = IF(auth_provider = 'local' AND password_hash IS NOT NULL, auth_provider, 'google')
     WHERE id = ?`,
    [googleId, userId],
  );
}

export async function insertGoogleUser({ fullName, email, googleId }) {
  const [result] = await pool.query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, email_verified, auth_provider, google_id)
     VALUES (?, ?, NULL, NULL, 'owner', 1, 'google', ?)`,
    [fullName, email, googleId],
  );
  return result.insertId;
}

export async function listUsersForAdmin() {
  const [rows] = await pool.query(
    'SELECT id, full_name, email, phone, role, email_verified, auth_provider, created_at FROM users ORDER BY created_at DESC',
  );
  return rows;
}

export async function selectAdminEmailsFromDb() {
  const [rows] = await pool.query("SELECT email FROM users WHERE role = 'admin'");
  return rows.map((r) => r.email).filter(Boolean);
}

export async function selectUserContactById(ownerId) {
  const [u] = await pool.query('SELECT full_name, email FROM users WHERE id = ?', [ownerId]);
  return u[0] || null;
}

export async function selectUserPublisherFields(userId) {
  const [u] = await pool.query('SELECT full_name, email, phone FROM users WHERE id = ?', [userId]);
  return u[0] || null;
}

export async function selectUserBillingById(userId) {
  const [u] = await pool.query('SELECT full_name, email FROM users WHERE id = ?', [userId]);
  return u[0] || null;
}

export async function adminExistsByEmail(email) {
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  return existing.length > 0;
}

export async function insertAdminUser({ full_name, email, password_hash }) {
  await pool.query(
    `INSERT INTO users (full_name, email, phone, password_hash, role)
     VALUES (?, ?, NULL, ?, 'admin')`,
    [full_name, email, password_hash],
  );
}
