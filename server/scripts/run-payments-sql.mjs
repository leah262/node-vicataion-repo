/**
 * יוצר את טבלת `payments` (PayMe) במסד — אידמפוטנטי.
 * הרצה מתוך תיקיית server:
 *   npm run setup-payments
 *
 * משתמש באותם משתני סביבה כמו השרת, כולל מעבר אוטומטי מ־DB_HOST פנימי
 * (mysql.railway.internal) ל־host ציבורי מ־DATABASE_URL כשמריצים מהמחשב המקומי.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..');
const dbDir = path.join(serverRoot, '../db');

dotenv.config({ path: path.join(serverRoot, '.env') });
const envLocalPath = path.join(serverRoot, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

function applyDatabaseUrlIfNeeded() {
  const hasUser = process.env.DB_USER && String(process.env.DB_USER).trim() !== '';
  const url = process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim();
  if (hasUser || !url) return;
  try {
    const u = new URL(url);
    if (u.protocol !== 'mysql:' && u.protocol !== 'mysql2:') return;
    if (!process.env.DB_HOST) process.env.DB_HOST = u.hostname;
    if (!process.env.DB_PORT || process.env.DB_PORT === '') {
      process.env.DB_PORT = u.port || '3306';
    }
    if (!process.env.DB_USER) process.env.DB_USER = decodeURIComponent(u.username);
    if (process.env.DB_PASSWORD === undefined || process.env.DB_PASSWORD === '') {
      process.env.DB_PASSWORD = decodeURIComponent(u.password);
    }
    const dbPath = u.pathname.replace(/^\//, '').split('?')[0];
    if (dbPath && !process.env.DB_NAME) process.env.DB_NAME = dbPath;
  } catch {
    /* ignore */
  }
}

function preferPublicMysqlHostFromDatabaseUrl() {
  const host = String(process.env.DB_HOST || '').trim();
  if (!host.includes('.internal')) return;
  const urlRaw = process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim();
  if (!urlRaw) return;
  try {
    const u = new URL(urlRaw);
    if (u.protocol !== 'mysql:' && u.protocol !== 'mysql2:') return;
    const urlHost = u.hostname;
    if (!urlHost || urlHost.includes('.internal')) return;
    process.env.DB_HOST = urlHost;
    if (u.port) process.env.DB_PORT = u.port;
    console.warn(
      `[setup-payments] DB_HOST היה פנימי (${host}); משתמשים ב־${urlHost}:${u.port || '3306'} מ־DATABASE_URL.`,
    );
  } catch {
    /* ignore */
  }
}

applyDatabaseUrlIfNeeded();
preferPublicMysqlHostFromDatabaseUrl();

function getSslConfig() {
  const sslMode = (process.env.DB_SSL_MODE || '').toUpperCase();
  const host = String(process.env.DB_HOST || '');

  if (sslMode === 'OFF' || sslMode === 'DISABLED' || sslMode === 'FALSE') {
    return undefined;
  }

  // Railway public DB — לא לערבב עם ca.pem מקומי (לעיתים שובר את השרשרת)
  if (host.includes('rlwy.net') || host.includes('railway')) {
    return { rejectUnauthorized: false };
  }

  const caPath = path.join(dbDir, 'ca.pem');
  if (fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath), rejectUnauthorized: true };
  }

  if (sslMode === 'REQUIRED' || sslMode === 'TRUE') {
    return { rejectUnauthorized: false };
  }

  return undefined;
}

const CREATE_PAYMENTS = `
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  payme_transaction_id VARCHAR(191) NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'ILS',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payments_payme_txn (payme_transaction_id),
  INDEX idx_payments_user_created (user_id, created_at),
  CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`;

async function run() {
  const host = process.env.DB_HOST;
  const dbName = process.env.DB_NAME;
  console.log(`Connecting to ${host}:${process.env.DB_PORT} / ${dbName} ...`);

  const conn = await mysql.createConnection({
    host,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: getSslConfig(),
    multipleStatements: true,
    connectTimeout: 25000,
  });

  try {
    await conn.query(CREATE_PAYMENTS);
    console.log('✓ טבלת payments נוצרה (או כבר הייתה קיימת).');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('FAILED:', err.code || '', err.message);
  console.error(
    '\nאם החיבור נכשל: הריצו את אותו SQL מלוח ה־MySQL ב־Railway (Data → Query),\n' +
      'או הגדירו ב־server/.env כתובת ציבורית ל־DB_HOST מתוך DATABASE_URL והריצו שוב: npm run setup-payments\n',
  );
  process.exit(1);
});
