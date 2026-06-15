import { logger } from '../utils/logger.js';

/**
 * Express error-handling middleware — מרכז תגובות לשגיאות מ-async route handlers.
 * השתמשו ב-asyncHandler על ה-handlers ו-throw new HttpError(status, message, code?).
 */
export function errorHandler(err, req, res, _next) {
  if (res.headersSent) {
    return;
  }
  const status = Number(err.status || err.statusCode || 500) || 500;
  const payload = { error: err.message || 'Server error' };
  if (err.code) payload.code = err.code;
  if (status >= 500) {
    logger.error(`[http ${status}] ${req.method} ${req.originalUrl}:`, err);
  }
  res.status(status).json(payload);
}
