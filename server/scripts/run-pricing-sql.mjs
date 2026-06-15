// הרצת db/pricing_tables.sql (ו־seed_pricing.sql אם קיים) — אותו חיבור כמו setup-db.mjs
// מריץ מתוך server/:  node scripts/run-pricing-sql.mjs

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
  const pricingPath = path.join(dbDir, 'pricing_tables.sql');
  const seedPricingPath = path.join(dbDir, 'seed_pricing.sql');

  if (!fs.existsSync(pricingPath)) {
    console.error('Missing file:', pricingPath);
    process.exit(1);
  }

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
    console.log('Running pricing_tables.sql ...');
    await conn.query(sanitize(fs.readFileSync(pricingPath, 'utf8')));
    console.log('  ✓ pricing_plans, pricing_promotions');

    if (fs.existsSync(seedPricingPath)) {
      console.log('Running seed_pricing.sql ...');
      await conn.query(sanitize(fs.readFileSync(seedPricingPath, 'utf8')));
      console.log('  ✓ seed pricing');
    }

    const [rows] = await conn.query('SELECT COUNT(*) AS n FROM pricing_plans');
    console.log(`\npricing_plans rows: ${rows[0].n}`);
    console.log('Done ✅');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
