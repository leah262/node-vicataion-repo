// מיגרציה אידמפוטנטית למסד נתונים קיים — מוסיפה עמודות/טבלאות חדשות
// עבור: אימות אימייל, התחברות גוגל, תוקף מודעה, טבלת פניות, וטבלת תשלומי PayMe (`payments`).
// הרצה:  node scripts/migrate.mjs
// בטוח להריץ כמה פעמים — מדלג על שינויים שכבר בוצעו.

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

function getSslConfig() {
  const sslMode = (process.env.DB_SSL_MODE || '').toUpperCase();
  if (['OFF', 'DISABLED', 'FALSE', ''].includes(sslMode)) return undefined;
  const caPath = path.join(dbDir, 'ca.pem');
  if (fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath), rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [process.env.DB_NAME, table, column],
  );
  return rows[0].n > 0;
}

async function addColumn(conn, table, column, definition) {
  if (await columnExists(conn, table, column)) {
    console.log(`  • ${table}.${column} כבר קיים — דילוג`);
    return;
  }
  await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`  ✓ נוסף ${table}.${column}`);
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.tables
     WHERE table_schema = ? AND table_name = ?`,
    [process.env.DB_NAME, table],
  );
  return rows[0].n > 0;
}

async function indexExists(conn, table, indexName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.statistics
     WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
    [process.env.DB_NAME, table, indexName],
  );
  return rows[0].n > 0;
}

async function addIndex(conn, table, indexName, columns) {
  if (await indexExists(conn, table, indexName)) {
    console.log(`  • אינדקס ${indexName} כבר קיים — דילוג`);
    return;
  }
  await conn.query(`ALTER TABLE ${table} ADD INDEX ${indexName} (${columns})`);
  console.log(`  ✓ נוסף אינדקס ${indexName}`);
}

// המרת עמודת ENUM ל-VARCHAR (אידמפוטנטי — בטוח להריץ שוב).
async function enumToVarchar(conn, table, column, definition) {
  await conn.query(`ALTER TABLE ${table} MODIFY COLUMN ${column} ${definition}`);
  console.log(`  ✓ ${table}.${column} הומר ל-VARCHAR`);
}

async function run() {
  console.log(`Connecting to ${process.env.DB_HOST}:${process.env.DB_PORT} / ${process.env.DB_NAME} ...`);
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: getSslConfig(),
    multipleStatements: true,
    connectTimeout: 20000,
  });

  try {
    console.log('\n[users]');
    await addColumn(conn, 'users', 'email_verified', 'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumn(conn, 'users', 'auth_provider', "VARCHAR(20) NOT NULL DEFAULT 'local'");
    await addColumn(conn, 'users', 'google_id', 'VARCHAR(255) NULL');
    // password_hash צריך להיות nullable עבור משתמשי גוגל
    await conn.query('ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL');
    console.log('  ✓ password_hash הפך ל-NULL-able');
    // משתמשים קיימים נחשבים מאומתים כדי שלא ינעלו מחוץ לחשבון
    const [upd] = await conn.query('UPDATE users SET email_verified = 1 WHERE email_verified = 0');
    console.log(`  ✓ סומנו ${upd.affectedRows} משתמשים קיימים כמאומתים`);

    console.log('\n[apartments]');
    await addColumn(conn, 'apartments', 'expires_at', 'DATETIME NULL');
    await addColumn(conn, 'apartments', 'expiry_reminder_sent', 'TINYINT(1) NOT NULL DEFAULT 0');

    console.log('\n[contact_messages]');
    await conn.query(
      `CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    console.log('  ✓ טבלת contact_messages קיימת');
    // קישור פניות "צור קשר" למשתמש מחובר (לאזור האישי).
    await addColumn(conn, 'contact_messages', 'user_id', 'INT NULL');
    await addIndex(conn, 'contact_messages', 'idx_contact_user', 'user_id');
    await addIndex(conn, 'contact_messages', 'idx_contact_email', 'email');

    // ───────── הסרת ENUMs: המרה ל-VARCHAR (ולידציה נאכפת באפליקציה) ─────────
    console.log('\n[enums → varchar]');
    await enumToVarchar(conn, 'users', 'role', "VARCHAR(20) NOT NULL DEFAULT 'owner'");
    await enumToVarchar(conn, 'apartments', 'status', "VARCHAR(20) NOT NULL DEFAULT 'pending'");
    await tableExists(conn, 'listing_payments') &&
      (await enumToVarchar(conn, 'listing_payments', 'status', "VARCHAR(20) NOT NULL DEFAULT 'pending'"));
    await tableExists(conn, 'bookings') &&
      (await enumToVarchar(conn, 'bookings', 'status', "VARCHAR(20) NOT NULL DEFAULT 'pending'"));
    if (await tableExists(conn, 'pricing_plans')) {
      await enumToVarchar(conn, 'pricing_plans', 'category', "VARCHAR(20) NOT NULL DEFAULT 'hosts'");
      await enumToVarchar(conn, 'pricing_plans', 'highlight_type', "VARCHAR(20) NOT NULL DEFAULT 'none'");
    }
    if (await tableExists(conn, 'pricing_promotions')) {
      await enumToVarchar(conn, 'pricing_promotions', 'discount_type', 'VARCHAR(20) NOT NULL');
    }
    if (await tableExists(conn, 'faq_items')) {
      await enumToVarchar(conn, 'faq_items', 'section', 'VARCHAR(20) NOT NULL');
    }

    // ───────── אינדקסים לסינונים נפוצים ─────────
    console.log('\n[indexes]');
    await addIndex(conn, 'apartments', 'idx_apartments_expires', 'expires_at');
    await addIndex(conn, 'apartments', 'idx_apartments_location', 'location');
    await addIndex(conn, 'apartments', 'idx_apartments_price', 'price_per_night');
    await addIndex(conn, 'apartments', 'idx_apartments_guests', 'max_guests');
    await addIndex(conn, 'apartments', 'idx_apartments_bedrooms', 'bedrooms');
    await addIndex(conn, 'apartments', 'idx_apartments_property_type', 'property_type');
    await addIndex(conn, 'apartments', 'idx_apartments_status_avail', 'status, is_available');

    console.log('\n[payments / payme]');
    await conn.query(
      `CREATE TABLE IF NOT EXISTS payments (
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
      )`,
    );
    console.log('  ✓ טבלת payments קיימת (PayMe)');

    console.log('\nDone ✅');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('MIGRATION FAILED:', err.code || '', err.message);
  process.exit(1);
});
