import pool from '../config/db.js';

export async function insertContactMessageWithUserId(full_name, email, phone, message, userId) {
  await pool.query(
    `INSERT INTO contact_messages (full_name, email, phone, message, user_id)
     VALUES (?, ?, ?, ?, ?)`,
    [full_name, email, phone, message, userId],
  );
}

export async function insertContactMessageLegacy(full_name, email, phone, message) {
  await pool.query(
    `INSERT INTO contact_messages (full_name, email, phone, message)
     VALUES (?, ?, ?, ?)`,
    [full_name, email, phone, message],
  );
}

export async function listContactMessagesForUser(userId, emailLower) {
  const [rows] = await pool.query(
    `SELECT id, full_name, email, phone, message, created_at
     FROM contact_messages
     WHERE user_id = ? OR LOWER(email) = ?
     ORDER BY created_at DESC`,
    [userId, emailLower],
  );
  return rows;
}

export async function listContactMessagesByEmailOnly(emailLower) {
  const [rows] = await pool.query(
    `SELECT id, full_name, email, phone, message, created_at
     FROM contact_messages
     WHERE LOWER(email) = ?
     ORDER BY created_at DESC`,
    [emailLower],
  );
  return rows;
}

/** שומר פנייה — נסיון עם user_id, ואם העמודה לא קיימת בלי user_id */
export async function insertContactMessageBestEffort(full_name, email, phone, message, userId) {
  try {
    await insertContactMessageWithUserId(full_name, email, phone, message, userId);
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      await insertContactMessageLegacy(full_name, email, phone, message);
    } else {
      throw err;
    }
  }
}

/** טוען פניות למשתמש — מתאים לסכמות ישנות / טבלה חסרה */
export async function listContactMessagesForUserSafe(userId, emailLower) {
  try {
    return await listContactMessagesForUser(userId, emailLower);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return [];
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      try {
        return await listContactMessagesByEmailOnly(emailLower);
      } catch (e2) {
        if (e2.code === 'ER_NO_SUCH_TABLE') return [];
        throw e2;
      }
    }
    throw err;
  }
}
