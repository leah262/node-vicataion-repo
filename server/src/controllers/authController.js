import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import {
  findUserByEmail,
  findUserById,
  findUserIdByEmail,
  insertGoogleUser,
  insertLocalUser,
  listUsersForAdmin,
  mergeGoogleUser,
  setEmailVerified,
  updatePasswordAndVerify,
} from '../models/userModel.js';
import {
  signToken,
  signEmailToken,
  verifyEmailToken,
  signResetToken,
  verifyResetToken,
} from '../middlewares/auth.js';
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../utils/mailer.js';
import { getWebAppBaseForLinks } from '../config/publicUrls.js';
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    email_verified: !!row.email_verified,
    auth_provider: row.auth_provider || 'local',
    created_at: row.created_at,
  };
}

async function sendVerification(user) {
  const token = signEmailToken({ id: user.id, email: user.email });
  const verifyUrl = `${getWebAppBaseForLinks()}/verify-email?token=${encodeURIComponent(token)}`;
  await sendVerificationEmail({ to: user.email, fullName: user.full_name, verifyUrl });
}

function passwordFingerprint(passwordHash) {
  return String(passwordHash || '').slice(-12);
}

export async function register(req, res) {
  const { full_name, email, phone, password } = req.body || {};
  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'שם מלא, אימייל וסיסמה הם שדות חובה' });
  }
  if (!STRONG_PASSWORD.test(password)) {
    return res.status(400).json({
      error:
        'הסיסמה חלשה מדי. חייבת להכיל לפחות 8 תווים, אות גדולה, אות קטנה, ספרה ותו מיוחד.',
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await findUserIdByEmail(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'משתמש עם האימייל הזה כבר קיים' });
  }

  const password_hash = await bcrypt.hash(password, 12);
  const insertId = await insertLocalUser({
    full_name,
    email: normalizedEmail,
    phone,
    password_hash,
  });

  const user = publicUser(await findUserById(insertId));

  try {
    await sendVerification(user);
  } catch (err) {
    console.error('[mailer] שליחת מייל אימות נכשלה:', err.message);
  }

  res.status(201).json({
    pending_verification: true,
    email: user.email,
    message: 'נשלח אליך מייל לאימות החשבון. יש ללחוץ על הקישור שבמייל כדי להפעיל את החשבון.',
  });
}

export async function verifyEmail(req, res) {
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ error: 'חסר טוקן אימות' });
  }

  let decoded;
  try {
    decoded = verifyEmailToken(token);
  } catch {
    return res.status(400).json({ error: 'קישור האימות אינו תקין או שפג תוקפו' });
  }

  const user = await findUserById(decoded.id);
  if (!user) {
    return res.status(404).json({ error: 'המשתמש לא נמצא' });
  }

  const wasVerified = !!user.email_verified;
  if (!wasVerified) {
    await setEmailVerified(user.id);
    sendWelcomeEmail({ to: user.email, fullName: user.full_name }).catch((err) =>
      console.error('[mailer] מייל ברוכים-הבאים נכשל:', err.message),
    );
  }
  user.email_verified = 1;

  const authToken = signToken({ id: user.id, email: user.email, role: user.role });
  res.json({
    ok: true,
    email: user.email,
    already_verified: wasVerified,
    user: publicUser(user),
    token: authToken,
  });
}

export async function resendVerification(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'נדרש אימייל' });

  const row = await findUserByEmail(email);
  if (row && !row.email_verified) {
    try {
      await sendVerification(publicUser(row));
    } catch (err) {
      console.error('[mailer] שליחה חוזרת של מייל אימות נכשלה:', err.message);
    }
  }
  res.json({ ok: true, message: 'אם קיים חשבון שאינו מאומת, נשלח אליו מייל אימות חדש.' });
}

export async function forgotPassword(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'נדרש אימייל' });

  const user = await findUserByEmail(email);

  if (user && user.password_hash) {
    const token = signResetToken({
      id: user.id,
      email: user.email,
      fp: passwordFingerprint(user.password_hash),
    });
    const resetUrl = `${getWebAppBaseForLinks()}/reset-password?token=${encodeURIComponent(token)}`;
    try {
      await sendPasswordResetEmail({
        to: user.email,
        fullName: user.full_name,
        resetUrl,
      });
    } catch (err) {
      console.error('[mailer] שליחת מייל איפוס סיסמה נכשלה:', err.message);
    }
  }

  res.json({
    ok: true,
    message: 'אם קיים חשבון עם האימייל הזה, נשלח אליו קישור לאיפוס הסיסמה.',
  });
}

export async function resetPassword(req, res) {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ error: 'נדרשים טוקן וסיסמה חדשה' });
  }
  if (!STRONG_PASSWORD.test(password)) {
    return res.status(400).json({
      error:
        'הסיסמה חלשה מדי. חייבת להכיל לפחות 8 תווים, אות גדולה, אות קטנה, ספרה ותו מיוחד.',
    });
  }

  let decoded;
  try {
    decoded = verifyResetToken(token);
  } catch {
    return res.status(400).json({ error: 'קישור האיפוס אינו תקין או שפג תוקפו' });
  }

  const user = await findUserById(decoded.id);
  if (!user) {
    return res.status(404).json({ error: 'המשתמש לא נמצא' });
  }

  if (decoded.fp !== passwordFingerprint(user.password_hash)) {
    return res.status(400).json({ error: 'קישור האיפוס כבר נוצל או שאינו תקף עוד' });
  }

  const password_hash = await bcrypt.hash(password, 12);
  await updatePasswordAndVerify(user.id, password_hash);

  res.json({ ok: true, message: 'הסיסמה עודכנה בהצלחה. אפשר להתחבר עם הסיסמה החדשה.' });
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'נדרשים אימייל וסיסמה' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
  }

  if (!user.password_hash) {
    return res.status(401).json({
      error: 'החשבון נוצר באמצעות התחברות עם גוגל. יש להתחבר דרך כפתור "התחברות עם Google".',
    });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
  }

  if (!user.email_verified && user.role !== 'admin') {
    return res.status(403).json({
      error: 'החשבון עדיין לא אומת. נשלח אליך מייל אימות — יש ללחוץ על הקישור שבו.',
      needs_verification: true,
      email: user.email,
    });
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  res.json({ user: publicUser(user), token });
}

export async function googleAuth(req, res) {
  if (!googleClient) {
    return res.status(503).json({ error: 'התחברות עם גוגל אינה מוגדרת בשרת.' });
  }
  const { credential } = req.body || {};
  if (!credential) {
    return res.status(400).json({ error: 'חסר אסימון התחברות מגוגל' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'אימות מול גוגל נכשל' });
  }

  if (!payload?.email || !payload.email_verified) {
    return res.status(401).json({ error: 'חשבון הגוגל אינו כולל אימייל מאומת' });
  }

  const email = payload.email.trim().toLowerCase();
  const fullName = payload.name || email.split('@')[0];
  const googleId = payload.sub;

  const existingRow = await findUserByEmail(email);

  let userRow;
  let isNew = false;
  if (existingRow) {
    userRow = existingRow;
    await mergeGoogleUser(googleId, userRow.id);
  } else {
    isNew = true;
    const insertId = await insertGoogleUser({ fullName, email, googleId });
    userRow = await findUserById(insertId);
  }

  if (isNew) {
    sendWelcomeEmail({ to: email, fullName }).catch((err) =>
      console.error('[mailer] מייל ברוכים-הבאים (גוגל) נכשל:', err.message),
    );
  }

  const token = signToken({ id: userRow.id, email: userRow.email, role: userRow.role });
  res.json({ user: publicUser(userRow), token });
}

export async function me(req, res) {
  const user = await findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'המשתמש לא נמצא' });
  }
  res.json(publicUser(user));
}

export async function listUsers(_req, res) {
  const rows = await listUsersForAdmin();
  res.json(rows.map(publicUser));
}
