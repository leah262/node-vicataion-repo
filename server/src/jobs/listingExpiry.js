import cron from 'node-cron';
import { selectReminderTargets, setExpiryReminderSent, suspendExpiredApartments } from '../models/apartmentModel.js';
import { sendListingExpiryReminderEmail } from '../utils/mailer.js';
import { getWebAppBaseForLinks } from '../config/publicUrls.js';

function resolveOwner(apt) {
  return {
    email: apt.owner_email || apt.user_email || null,
    name: apt.owner_name || apt.user_full_name || '',
  };
}

const FIRST_REMINDER_DAYS = Number(process.env.EXPIRY_REMINDER_DAYS) || 7;
const FINAL_REMINDER_DAYS = Number(process.env.EXPIRY_FINAL_REMINDER_DAYS) || 1;

function daysUntil(date) {
  const ms = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function formatHebrewDate(date) {
  try {
    return new Intl.DateTimeFormat('he-IL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  } catch {
    return new Date(date).toISOString().slice(0, 10);
  }
}

async function sendReminderFor(apt, stageValue) {
  const owner = resolveOwner(apt);
  if (owner.email) {
    try {
      await sendListingExpiryReminderEmail({
        to: owner.email,
        fullName: owner.name,
        apartment: apt,
        renewUrl: `${getWebAppBaseForLinks()}/my-apartments/${apt.id}/renew`,
        expiryDate: formatHebrewDate(apt.expires_at),
        daysLeft: daysUntil(apt.expires_at),
      });
    } catch (err) {
      console.error(`[expiry] שליחת תזכורת למודעה ${apt.id} נכשלה:`, err.message);
    }
  }
  await setExpiryReminderSent(apt.id, stageValue);
}

async function sendFinalReminders() {
  const rows = await selectReminderTargets(FINAL_REMINDER_DAYS, 1);
  for (const apt of rows) await sendReminderFor(apt, 2);
  return rows.length;
}

async function sendFirstReminders() {
  const rows = await selectReminderTargets(FIRST_REMINDER_DAYS, 0);
  for (const apt of rows) await sendReminderFor(apt, 1);
  return rows.length;
}

export async function runExpiryCheck() {
  try {
    const finalReminded = await sendFinalReminders();
    const firstReminded = await sendFirstReminders();
    const suspended = await suspendExpiredApartments();
    if (firstReminded || finalReminded || suspended) {
      console.log(
        `[expiry] תזכורת ראשונה: ${firstReminded}, תזכורת אחרונה: ${finalReminded}, הושעו: ${suspended}`,
      );
    }
  } catch (err) {
    console.error('[expiry] בדיקת תוקף מודעות נכשלה:', err.message);
  }
}

export function startListingExpiryJob() {
  cron.schedule('0 9 * * *', runExpiryCheck);
  setTimeout(runExpiryCheck, 15000);
  console.log('[expiry] תזמון בדיקת תוקף מודעות הופעל (יומי 09:00).');
}
