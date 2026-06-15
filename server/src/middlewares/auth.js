import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export function signToken(payload) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// טוקן ייעודי לאימות אימייל (תוקף קצר). purpose מבדיל אותו מטוקן ההתחברות.
export function signEmailToken(payload, expiresIn = '24h') {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign({ ...payload, purpose: 'email-verify' }, JWT_SECRET, { expiresIn });
}

export function verifyEmailToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.purpose !== 'email-verify') {
    throw new Error('Invalid token purpose');
  }
  return decoded;
}

// טוקן ייעודי לאיפוס סיסמה (תוקף קצר). purpose מבדיל אותו מטוקנים אחרים.
export function signResetToken(payload, expiresIn = '24h') {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign({ ...payload, purpose: 'password-reset' }, JWT_SECRET, { expiresIn });
}

export function verifyResetToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.purpose !== 'password-reset') {
    throw new Error('Invalid token purpose');
  }
  return decoded;
}

// טוקן ייעודי לאישור מודעה בקליק מתוך מייל המנהל (purpose נפרד, תוקף ארוך יותר).
export function signApproveToken(payload, expiresIn = '14d') {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign({ ...payload, purpose: 'listing-approve' }, JWT_SECRET, { expiresIn });
}

export function verifyApproveToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.purpose !== 'listing-approve') {
    throw new Error('Invalid token purpose');
  }
  return decoded;
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

// Requires a valid token. Populates req.user = { id, email, role }.
export function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Populates req.user when a token is present, but never blocks the request.
export function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      req.user = null;
    }
  }
  next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
