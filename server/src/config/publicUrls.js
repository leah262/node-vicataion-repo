/**
 * כתובות ציבוריות — בלי הנחת "לקוח React" על localhost:3000.
 * APP_URL = אתר/SPA בפרודקשן (אופציונלי). PUBLIC_API_URL = בסיס ה-API לקישורים במיילים וכו׳.
 */

/** בסיס ה-API כולל /api (למשל קישורי email-approve). */
export function getPublicApiBase() {
  const explicit = process.env.PUBLIC_API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) {
    const host = railway.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${host}/api`;
  }
  const port = String(process.env.PORT || '5000').trim();
  return `http://127.0.0.1:${port}/api`;
}

/** מקור השרת בלי סיומת /api */
export function getApiOrigin() {
  return getPublicApiBase().replace(/\/api\/?$/, '');
}

/** רק אם הוגדר במפורש — אתר ציבורי/SPA (לא ברירת מחדל ללקוח שלא בפרויקט). */
export function getPublicSiteBase() {
  const raw = process.env.APP_URL?.trim();
  if (raw) return raw.replace(/\/+$/, '');
  return '';
}

/**
 * לינקים בסגנון "אתר" במיילים (/verify-email, /apartments/…):
 * APP_URL אם קיים, אחרת בסיס השרת (אותו מארח כמו ה-API).
 */
export function getWebAppBaseForLinks() {
  return getPublicSiteBase() || getApiOrigin();
}
