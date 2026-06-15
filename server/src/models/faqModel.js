import pool from '../config/db.js';

export async function selectAllFaqItemsAdmin() {
  const [rows] = await pool.query(
    'SELECT id, section, question, answer, sort_order, created_at, updated_at FROM faq_items ORDER BY section ASC, sort_order ASC, id ASC',
  );
  return rows;
}

export async function insertFaqItem(section, question, answer, sortOrder) {
  const [result] = await pool.query(
    `INSERT INTO faq_items (section, question, answer, sort_order) VALUES (?, ?, ?, ?)`,
    [section, question, answer, sortOrder],
  );
  return result.insertId;
}

export async function selectFaqItemById(id) {
  const [rows] = await pool.query('SELECT * FROM faq_items WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function faqItemExistsId(id) {
  const [existing] = await pool.query('SELECT id FROM faq_items WHERE id = ?', [id]);
  return existing.length > 0;
}

export async function updateFaqItem(id, section, question, answer, sortOrder) {
  await pool.query(
    'UPDATE faq_items SET section = ?, question = ?, answer = ?, sort_order = ? WHERE id = ?',
    [section, question, answer, sortOrder, id],
  );
}

export async function deleteFaqItem(id) {
  const [r] = await pool.query('DELETE FROM faq_items WHERE id = ?', [id]);
  return r.affectedRows || 0;
}

export async function selectFaqCatalogRows() {
  const [rows] = await pool.query(
    'SELECT id, section, question, answer, sort_order FROM faq_items ORDER BY section ASC, sort_order ASC, id ASC',
  );
  return rows;
}
