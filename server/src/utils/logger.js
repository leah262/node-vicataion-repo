// Logger מרכזי: לוגים אינפורמטיביים (info/debug) מושתקים בפרודקשן,
// בעוד שגיאות ואזהרות נרשמות תמיד. כך אין רעש ב-stdout בפרודקשן,
// אך תקלות אמיתיות עדיין מתועדות.

const isProd = process.env.NODE_ENV === 'production';

export const logger = {
  info(...args) {
    if (!isProd) console.log(...args);
  },
  debug(...args) {
    if (!isProd) console.log(...args);
  },
  warn(...args) {
    console.warn(...args);
  },
  error(...args) {
    console.error(...args);
  },
};

export default logger;
