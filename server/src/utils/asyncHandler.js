/**
 * עוטף async Express handler כך ש-rejections מגיעות ל-errorHandler.
 */
export function asyncHandler(fn) {
  return function asyncHandlerWrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
