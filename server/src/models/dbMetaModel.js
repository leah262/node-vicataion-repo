import pool from '../config/db.js';

export async function selectDatabaseInfo() {
  const [rows] = await pool.query('SELECT DATABASE() AS db_name, VERSION() AS version');
  return rows[0] || null;
}
