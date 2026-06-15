
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

function sourceSsl() {
  const mode = (process.env.DB_SSL_MODE || '').toUpperCase();
  if (['OFF', 'DISABLED', 'FALSE', ''].includes(mode)) return undefined;
  const caPath = path.join(dbDir, 'ca.pem');
  if (fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath), rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

function parseTargetUrl() {
  const url = process.env.TARGET_DATABASE_URL;
  if (!url) {
    console.error(
      '\n❌ חסר משתנה סביבה TARGET_DATABASE_URL (כתובת ה-MySQL של Railway).\n' +
        '   קח אותו מ-Railway → MySQL → Variables → MYSQL_PUBLIC_URL והרץ למשל:\n' +
        '   $env:TARGET_DATABASE_URL="mysql://root:PASS@HOST.rlwy.net:PORT/railway"; node scripts/copy-to-railway.mjs\n',
    );
    process.exit(1);
  }
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '') || 'railway',
    // Railway (proxy ציבורי) בדרך כלל לא דורש SSL; ניתן להפעיל עם TARGET_DB_SSL=true
    ssl: process.env.TARGET_DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true,
    connectTimeout: 20000,
  };
}

// המרת ערך משורת מקור לערך בטוח להכנסה (JSON אובייקטים → טקסט).
function normalize(v) {
  if (v === null || v === undefined) return null;
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Date) return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

const BATCH = 500;

async function run() {
  const srcCfg = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: sourceSsl(),
    connectTimeout: 20000,
  };
  const dstCfg = parseTargetUrl();

  console.log(`\nמקור (Aiven):   ${srcCfg.host}:${srcCfg.port}/${srcCfg.database}`);
  console.log(`יעד  (Railway): ${dstCfg.host}:${dstCfg.port}/${dstCfg.database}\n`);

  const src = await mysql.createConnection(srcCfg);
  const dst = await mysql.createConnection(dstCfg);

  try {
    // איפוס sql_mode: במקור — כדי ש-SHOW CREATE TABLE ישתמש בגרשיים (`) ולא במרכאות
    // כפולות (ANSI_QUOTES); ביעד — כדי להימנע מדחיית ערכים במצב strict בזמן הייבוא.
    await src.query("SET SESSION sql_mode = ''");
    await dst.query("SET SESSION sql_mode = ''");

    const [tableRows] = await src.query(
      `SELECT table_name AS t FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
      [srcCfg.database],
    );
    const tables = tableRows.map((r) => r.t);
    if (tables.length === 0) {
      console.log('לא נמצאו טבלאות במקור. אין מה להעתיק.');
      return;
    }
    console.log(`נמצאו ${tables.length} טבלאות: ${tables.join(', ')}\n`);

    await dst.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of tables) {
      const [[createRow]] = await src.query(`SHOW CREATE TABLE \`${table}\``);
      const createSql = createRow['Create Table'];

      console.log(`▸ ${table}`);
      await dst.query(`DROP TABLE IF EXISTS \`${table}\``);
      await dst.query(createSql);

      const [rows] = await src.query(`SELECT * FROM \`${table}\``);
      if (rows.length === 0) {
        console.log('   (ריק)');
        continue;
      }

      const cols = Object.keys(rows[0]);
      const colList = cols.map((c) => `\`${c}\``).join(', ');
      const insertSql = `INSERT INTO \`${table}\` (${colList}) VALUES ?`;

      let copied = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH).map((row) => cols.map((c) => normalize(row[c])));
        await dst.query(insertSql, [chunk]);
        copied += chunk.length;
      }
      console.log(`   ✓ הועתקו ${copied} שורות`);
    }

    await dst.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n──────── סיכום (ספירת שורות ביעד) ────────');
    for (const table of tables) {
      const [[{ n }]] = await dst.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
      console.log(`  ${table.padEnd(24)} ${n}`);
    }
    console.log('\nהמיגרציה הסתיימה בהצלחה ✅');
  } finally {
    await src.end();
    await dst.end();
  }
}

run().catch((err) => {
  console.error('\nMIGRATION FAILED:', err.code || '', err.message);
  process.exit(1);
});
