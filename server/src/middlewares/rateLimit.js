// Rate limiter קל-משקל בזיכרון להגנה מפני brute-force על נתיבי אימות.
// מגביל מספר בקשות לכל כתובת IP בחלון זמן נתון.
// הערה: מתאים לפריסה של אינסטנס יחיד. לריבוי אינסטנסים מומלץ store חיצוני (Redis).

function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map(); // ip -> { count, resetAt }

  // ניקוי תקופתי של רשומות שפג תוקפן כדי למנוע דליפת זיכרון.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(ip);
    }
  }, windowMs);
  if (typeof sweep.unref === 'function') sweep.unref();

  return function rateLimit(req, res, next) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(ip);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: message || 'יותר מדי בקשות. נסו שוב בעוד מספר דקות.',
        retry_after_seconds: retryAfter,
      });
    }

    next();
  };
}

// הגבלה הדוקה לניסיונות התחברות/הרשמה (הגנת brute-force).
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 20,
  message: 'יותר מדי ניסיונות. נסו שוב בעוד 15 דקות.',
});

// הגבלה רכה לפעולות רגישות שנשלחות במייל (שכחתי סיסמה / שליחה חוזרת של אימות).
export const sensitiveLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_SENSITIVE_MAX) || 10,
  message: 'יותר מדי בקשות. נסו שוב בעוד שעה.',
});

// הגבלה ליצירת תשלומי PayMe (מומלץ: Redis / שיתוף מצב בין אינסטנסים בפרודקשן).
export const paymeCreateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PAYME_CREATE_MAX) || 60,
  message: 'יותר מדי בקשות ליצירת תשלום. נסו שוב בעוד מספר דקות.',
});

export { createRateLimiter };
