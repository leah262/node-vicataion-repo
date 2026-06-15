import pool from '../config/db.js';

let tableReady = false;

export async function ensureSiteContentTable() {
  if (tableReady) return;
  await pool.query(
    `CREATE TABLE IF NOT EXISTS site_content (
       content_key VARCHAR(191) PRIMARY KEY,
       body TEXT NULL,
       font_size VARCHAR(20) NULL,
       color VARCHAR(30) NULL,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
     )`,
  );
  try {
    await pool.query('ALTER TABLE site_content ADD COLUMN color VARCHAR(30) NULL');
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') throw err;
  }
  tableReady = true;
}

export async function selectAllSiteContent() {
  const [rows] = await pool.query('SELECT content_key, body, font_size, color FROM site_content');
  return rows;
}

export async function upsertSiteContent(key, text, fontSize, color) {
  await pool.query(
    `INSERT INTO site_content (content_key, body, font_size, color)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE body = VALUES(body), font_size = VALUES(font_size), color = VALUES(color)`,
    [key, text, fontSize, color],
  );
}

export async function deleteSiteContentByKey(key) {
  await pool.query('DELETE FROM site_content WHERE content_key = ?', [key]);
}
