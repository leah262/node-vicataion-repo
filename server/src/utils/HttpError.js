export class HttpError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} message
   * @param {string} [code] optional machine-readable code for JSON body
   */
  constructor(status, message, code) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}
