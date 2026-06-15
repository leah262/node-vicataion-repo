import {
  insertContactMessageBestEffort,
  listContactMessagesForUserSafe,
} from '../models/contactMessageModel.js';
import { sendContactToAdmin, sendContactConfirmationEmail } from '../utils/mailer.js';

function getAdminNotifyEmails() {
  const raw = process.env.ADMIN_NOTIFY_EMAIL || process.env.SMTP_USER || '';
  return raw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

export async function postContact(req, res) {
  const { full_name, email, phone, message } = req.body || {};
  const userId = req.user?.id || null;

  if (!full_name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'שם, אימייל והודעה הם שדות חובה' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'כתובת אימייל לא תקינה' });
  }

  if (String(message).trim().length < 10) {
    return res.status(400).json({ error: 'ההודעה קצרה מדי' });
  }

  const contact = {
    full_name: full_name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || null,
    message: message.trim(),
  };

  try {
    await insertContactMessageBestEffort(
      contact.full_name,
      contact.email,
      contact.phone,
      contact.message,
      userId,
    );
  } catch {
    /* טבלה אולי לא קיימת */
  }

  (async () => {
    try {
      const adminEmails = getAdminNotifyEmails();
      if (adminEmails.length > 0) {
        await sendContactToAdmin({ to: adminEmails.join(', '), contact });
      }
    } catch (err) {
      console.error('[mailer] מייל פנייה למנהל נכשל:', err.message);
    }
    try {
      await sendContactConfirmationEmail({ to: contact.email, fullName: contact.full_name });
    } catch (err) {
      console.error('[mailer] מייל אישור פנייה לפונה נכשל:', err.message);
    }
  })();

  res.status(201).json({ ok: true, message: 'ההודעה נשלחה בהצלחה' });
}

export async function getMyContactMessages(req, res) {
  const email = (req.user.email || '').toLowerCase();
  const rows = await listContactMessagesForUserSafe(req.user.id, email);
  return res.json(rows);
}
