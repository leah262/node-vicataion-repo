/**
 * Validates JSON body for POST /api/payments/create (PayMe checkout bootstrap).
 * Keep rules strict to reduce abuse; amounts are always confirmed server-side against your business rules.
 */
export function validatePayMeCreateBody(req, res, next) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const amount = body.amount;
  const currencyRaw = body.currency;

  if (amount === undefined || amount === null || amount === '') {
    return res.status(400).json({ error: 'amount is required' });
  }
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  if (n > 1_000_000) {
    return res.status(400).json({ error: 'amount exceeds allowed maximum' });
  }

  let currency = 'ILS';
  if (currencyRaw !== undefined && currencyRaw !== null && String(currencyRaw).trim() !== '') {
    currency = String(currencyRaw).trim().toUpperCase();
    if (!/^[A-Z]{3,8}$/.test(currency)) {
      return res.status(400).json({ error: 'currency must be 3–8 uppercase letters' });
    }
  }

  const description = body.description != null ? String(body.description).slice(0, 500) : undefined;

  /** Optional opaque metadata (stored only in PayMe payload if supported). */
  let metadata = body.metadata;
  if (metadata !== undefined && metadata !== null && typeof metadata !== 'object') {
    return res.status(400).json({ error: 'metadata must be an object when provided' });
  }
  if (metadata && typeof metadata === 'object') {
    // Shallow stringify guard — avoid huge blobs.
    try {
      const s = JSON.stringify(metadata);
      if (s.length > 4000) {
        return res.status(400).json({ error: 'metadata is too large' });
      }
    } catch {
      return res.status(400).json({ error: 'metadata must be JSON-serializable' });
    }
  }

  req.paymeCreate = { amount: n, currency, description, metadata };
  next();
}
