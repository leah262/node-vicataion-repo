// סקריפט הקמת מסד הנתונים מתוך קבצי ה-SQL.
// משתמש באותן הגדרות חיבור של השרת (server/.env, ובמקומי .env.local.disabled לא נטען).
// מריץ:  node scripts/setup-db.mjs
//
// עובד גם מול Aiven (defaultdb) וגם מול MySQL מקומי. שורות USE / CREATE DATABASE
// מוסרות אוטומטית כי החיבור כבר מצביע על מסד הנתונים הנכון (DB_NAME).

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..');
const dbDir = path.join(serverRoot, '../db');

const envLocalPath = path.join(serverRoot, '.env.local');
dotenv.config({ path: path.join(serverRoot, '.env') });
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

// מסיר הצהרות שלא רלוונטיות בענן ושומר רק את גוף ה-SQL.
function sanitize(sql) {
  return sql
    .split('\n')
    .filter((line) => {
      const t = line.trim().toUpperCase();
      return !t.startsWith('USE ') && !t.startsWith('CREATE DATABASE');
    })
    .join('\n');
}

async function run() {
  const schemaSql = sanitize(fs.readFileSync(path.join(dbDir, 'schema.sql'), 'utf8'));
  const seedSql = sanitize(fs.readFileSync(path.join(dbDir, 'seed.sql'), 'utf8'));

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
    console.log('Running schema.sql ...');
    await conn.query(schemaSql);
    console.log('  ✓ schema created');

    console.log('Running seed.sql ...');
    await conn.query(seedSql);
    console.log('  ✓ data seeded');

    const [apts] = await conn.query('SELECT COUNT(*) AS n FROM apartments');
    const [imgs] = await conn.query('SELECT COUNT(*) AS n FROM apartment_images');
    const [users] = await conn.query('SELECT COUNT(*) AS n FROM users');
    console.log('\nResult:');
    console.log(`  apartments:        ${apts[0].n}`);
    console.log(`  apartment_images:  ${imgs[0].n}`);
    console.log(`  users:             ${users[0].n}`);
    console.log('\nDone ✅');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('SETUP FAILED:', err.code || '', err.message);
  process.exit(1);
});
