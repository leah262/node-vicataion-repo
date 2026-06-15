// הגדרת CORS לפרודקשן: השרת מקבל בקשות רק מהדומיינים המורשים.
// מקור הרשימה: משתנה הסביבה CORS_ORIGINS (מופרד בפסיקים) או CLIENT_ORIGIN.
// בפיתוח: רק מארח ה-API עצמו + מה שמוגדר ב־CORS_ORIGINS (למשל SPA על פורט אחר).

const isProd = process.env.NODE_ENV === 'production';

const defaultPort = String(process.env.PORT || '5000').trim();
const DEV_ORIGINS = [
  `http://localhost:${defaultPort}`,
  `http://127.0.0.1:${defaultPort}`,
];

function configuredOrigins() {
  const raw = process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || '';
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

const allowList = isProd ? configuredOrigins() : [...DEV_ORIGINS, ...configuredOrigins()];

export const corsOptions = {
  origin(origin, callback) {
    // בקשות ללא Origin (כלים כמו curl, אפליקציות מובייל, בריאות שרת) — מותרות.
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, '');
    if (allowList.includes(normalized)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export { allowList as corsAllowList };
