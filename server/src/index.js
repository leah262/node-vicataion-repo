import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { testConnection } from './config/db.js';
import { corsOptions } from './config/cors.js';
import apartmentsRouter from './routes/apartments.js';
import authRouter from './routes/auth.js';
import paymentsRouter from './routes/payments.js';
import pricingPublicRouter from './routes/pricingPublic.js';
import pricingAdminRouter from './routes/pricingAdmin.js';
import uploadsRouter, { uploadsDir } from './routes/uploads.js';
import contactRouter from './routes/contact.js';
import faqPublicRouter from './routes/faqPublic.js';
import faqAdminRouter from './routes/faqAdmin.js';
import locationsRouter from './routes/locations.js';
import contentRouter from './routes/content.js';
import paypalOrdersRouter from './routes/paypalOrders.js';
import { getPayPalEnvStatus } from './services/paypalRest.js';
import { ensureAdminUser } from './bootstrap/ensureAdmin.js';
import { startListingExpiryJob } from './jobs/listingExpiry.js';
import { logger } from './utils/logger.js';
import { handlePayMeWebhookRequest } from './controllers/paymentController.js';
import { getPayMeEnvStatus } from './config/payme.js';
import { selectDatabaseInfo } from './models/dbMetaModel.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { getPublicSiteBase } from './config/publicUrls.js';

const app = express();
const PORT = process.env.PORT || 5000;

const isProd = process.env.NODE_ENV === 'production';

// מאחורי פרוקסי/לואד-בלאנסר בענן — מאפשר ל-req.ip לשקף את כתובת הלקוח האמיתית
// (חשוב ל-rate limiting). מופעל רק בפרודקשן.
if (isProd) {
  app.set('trust proxy', 1);
}

/** Dev CSP: השרת + מקורות נוספים מ־CSP_DEV_EXTRA_CONNECT (מופרד בפסיקים), בלי הנחת SPA קבוע. */
const devConnectSrc = [
  "'self'",
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  `ws://localhost:${PORT}`,
  `ws://127.0.0.1:${PORT}`,
  ...(process.env.CSP_DEV_EXTRA_CONNECT || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
];

app.use(cors(corsOptions));

/** API responses: explicit connect-src for dev (HMR / cross-port fetch). No Helmet dep — manual header. */
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  const connectSrc = isProd
    ? "'self'"
    : devConnectSrc.join(' ');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `connect-src ${connectSrc}`,
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
      "script-src 'none'",
      "style-src 'none'",
    ].join('; ')
  );
  next();
});

/**
 * PayMe webhooks must receive the raw body for signature verification.
 * TODO: If PayMe sends a non-JSON body (e.g. form-urlencoded), switch to `express.raw({ type: () => true })`
 * or a dedicated `express.text()` / `express.urlencoded()` chain per PayMe docs.
 */
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(handlePayMeWebhookRequest),
);

app.use(express.json({ limit: '2mb' }));

// Chrome DevTools probes this URL on localhost (Automatic workspace folders).
// Handle early so it always wins; restart the API after pulling changes.
const CHROME_DEVTOOLS_JSON = '/.well-known/appspecific/com.chrome.devtools.json';
app.use((req, res, next) => {
  const pathOnly = req.originalUrl.split('?')[0];
  if (req.method === 'GET' && pathOnly === CHROME_DEVTOOLS_JSON) {
    res.type('application/json').send('{}');
    return;
  }
  next();
});

const publicSite = getPublicSiteBase();
const clientUrlHint = process.env.CLIENT_DEV_URL?.trim() || publicSite || '';
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    const siteLine = clientUrlHint
      ? `<p>Public site (APP_URL / CLIENT_DEV_URL): <a href="${clientUrlHint}">${clientUrlHint}</a></p>`
      : '<p>No separate frontend URL configured. Set <code>APP_URL</code> or <code>CLIENT_DEV_URL</code> if you serve a SPA elsewhere.</p>';
    res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>API</title></head><body>
<p><strong>This is the backend API</strong> (port ${PORT}).</p>
${siteLine}
<p>API check: <a href="/api/health">/api/health</a></p>
</body></html>`);
    return;
  }
  res.json({
    service: 'vacation-rentals-api',
    client: clientUrlHint || null,
    endpoints: ['/api/health', '/api/auth', '/api/apartments', '/api/pricing', '/api/orders'],
  });
});

// תמונות חדשות נשמרות ב-Cloudinary בלבד. סטטי רק אם נשארו קבצים ישנים בתיקייה מקומית.
if (fs.existsSync(uploadsDir)) {
  app.use('/uploads', express.static(uploadsDir));
}

app.use('/api/auth', authRouter);
app.use('/api/apartments', apartmentsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/pricing', pricingPublicRouter);
app.use('/api/admin/pricing', pricingAdminRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/contact', contactRouter);
app.use('/api/faq', faqPublicRouter);
app.use('/api/admin/faq', faqAdminRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/content', contentRouter);
app.use('/api/orders', paypalOrdersRouter);

app.get('/api/health', async (_req, res) => {
  try {
    const dbStatus = await testConnection();
    const paypal = getPayPalEnvStatus();
    const payme = getPayMeEnvStatus();
    res.json({
      status: 'ok',
      message: 'Server is running',
      database: dbStatus.ok === 1 ? 'connected' : 'unknown',
      paypal,
      payme,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Server is running but database is unavailable',
      error: error.message,
    });
  }
});

app.get('/api/db-info', async (_req, res) => {
  try {
    const row = await selectDatabaseInfo();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  const pp = getPayPalEnvStatus();
  if (!pp.configured) {
    logger.warn(
      `[PayPal] חסרים משתני סביבה: hasClientId=${pp.hasClientId} hasClientSecret=${pp.hasClientSecret}. בדקו server/.env (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET) והפעלה מחדש. GET /api/health מחזיר את אותו סטטוס.`,
    );
  }
  const pm = getPayMeEnvStatus();
  if (!pm.configured) {
    logger.warn(
      `[PayMe] חסרים משתני סביבה או תצורה חלקית: configured=${pm.configured} baseUrl=${pm.hasBaseUrl} merchantId=${pm.hasMerchantId} apiKey=${pm.hasApiKey} secret=${pm.hasSecret} webhookSecret=${pm.hasWebhookSecret}. ראו docs/PAYME_INTEGRATION.md ו־GET /api/health.`,
    );
  }
  try {
    await ensureAdminUser();
  } catch (err) {
    logger.warn('[Auth] Could not ensure admin user:', err.message);
  }
  try {
    startListingExpiryJob();
  } catch (err) {
    logger.warn('[expiry] לא ניתן להפעיל את תזמון תוקף המודעות:', err.message);
  }
});
