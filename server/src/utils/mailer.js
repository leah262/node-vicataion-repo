import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// שליחת מיילים דרך SMTP. ההגדרות נטענות ממשתני סביבה (.env):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// אם לא הוגדר SMTP — השליחה מדלגת בשקט (כדי לא להפיל את הזרימה) ומדפיסה לוג.

let transporter = null;
let initialized = false;

// ── לוגו מוטמע (inline) לכותרת המיילים ──
// מוטמע כקובץ מצורף עם Content-ID כדי שיוצג אמין בכל לקוחות המייל (גם ללא חיבור לאתר).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '..', '..', '..', 'client', 'public', 'navbar-logo.png');
const LOGO_CID = 'brandlogo';

function detectImageMime(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  return 'application/octet-stream';
}

let logoAttachment;
function getLogoAttachment() {
  if (logoAttachment !== undefined) return logoAttachment;
  try {
    const content = fs.readFileSync(LOGO_PATH);
    const mime = detectImageMime(content);
    logoAttachment = {
      filename: mime === 'image/png' ? 'logo.png' : 'logo.jpg',
      content,
      cid: LOGO_CID,
      contentType: mime,
      contentDisposition: 'inline',
    };
  } catch {
    logoAttachment = null;
  }
  return logoAttachment;
}

function getTransporter() {
  if (initialized) return transporter;
  initialized = true;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[mailer] SMTP לא הוגדר (.env) — מיילים לא יישלחו.');
    return null;
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const insecureTls = String(process.env.SMTP_TLS_INSECURE).toLowerCase() === 'true';
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    ...(insecureTls ? { tls: { rejectUnauthorized: false } } : {}),
  });
  return transporter;
}

export function isMailerConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail({ to, subject, text, html, replyTo }) {
  const tx = getTransporter();
  if (!tx) return { skipped: true };

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const logo = html ? getLogoAttachment() : null;
  const info = await tx.sendMail({
    from,
    to,
    subject,
    text,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(logo ? { attachments: [logo] } : {}),
  });
  return { skipped: false, messageId: info.messageId };
}

// ───────────────────────── עזרי תבנית (Layout) ─────────────────────────

const BRAND = 'דירות נופש';
const TAGLINE = 'הדרך הפשוטה לתוספת הכנסה כשהבית פנוי';
const FOOTER_SLOGAN = 'מרוויחים כשהבית פנוי';
const GOLD = '#b8860b';
const NAVY = '#1a2b4a';
// תכלת — אותו גוון רקע של הלוגו (navbar-logo). משמש כרקע מסביב לכרטיס ההודעה.
const AZURE_BG = '#e6f1f8';
// פונט זהה לאתר (Heebo) עם נפילה חיננית ללקוחות מייל שאינם טוענים גופן חיצוני.
const FONT_STACK = "'Heebo','Segoe UI',Tahoma,Arial,sans-serif";

function firstName(fullName) {
  return fullName ? String(fullName).trim().split(/\s+/)[0] : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// כפתור CTA במייל
function button(href, label) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:10px;background:${GOLD};">
          <a href="${href}" target="_blank"
             style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;
                    font-family:${FONT_STACK};
                    color:#ffffff;text-decoration:none;border-radius:10px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

// מעטפת HTML אחידה לכל המיילים
function layout(innerHtml) {
  return `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap');
    /* פונט אחיד לכל אלמנט במייל — זהה לפונט האתר (Heebo) */
    body, div, p, span, a, h1, h2, h3, h4, table, td, th, strong, blockquote {
      font-family: ${FONT_STACK} !important;
    }
  </style>
  <div dir="rtl" style="margin:0;padding:0;background:${AZURE_BG};font-family:${FONT_STACK};">
    <div style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:${FONT_STACK};
                line-height:1.7;color:#1a1a1a;">
      <div style="text-align:center;padding:8px 0 20px;">
        <img src="cid:${LOGO_CID}" alt="${BRAND}" width="240"
             style="display:inline-block;width:240px;max-width:74%;height:auto;border:0;outline:none;text-decoration:none;" />
      </div>
      <div style="background:#ffffff;border:1px solid #d4e6f2;border-radius:16px;
                  padding:28px 26px;box-shadow:0 12px 32px -18px rgba(26,43,74,0.28);">
        ${innerHtml}
      </div>
      <div style="text-align:center;color:${NAVY};font-size:13px;padding:18px 8px 4px;font-family:${FONT_STACK};">
        <p style="margin:4px 0;font-weight:800;letter-spacing:0.01em;">${FOOTER_SLOGAN}</p>
      </div>
    </div>
  </div>`;
}

// ───────────────────────── 1. אימות אימייל ─────────────────────────
export async function sendVerificationEmail({ to, fullName, verifyUrl }) {
  const name = firstName(fullName);
  const subject = 'רק עוד לחיצה אחת... מאמתים את החשבון שלך! 🚀';
  const text = `שלום ${name},

שמחים לצרף אותך לנבחרת המארחים שלנו!

כדי להשלים את התהליך ולהפעיל את החשבון, כל מה שצריך לעשות זה ללחוץ על הקישור הבא:
${verifyUrl}

שים לב: אם קריאת המייל ואימות החשבון מתבצעים ממכשיר שונה מזה שנרשמת בו, תועבר לדף ההתחברות – שם יש להזין מחדש את פרטי הגישה שלך.

${BRAND} – ${TAGLINE}`;

  const html = layout(`
    <h2 style="margin:0 0 12px;color:${NAVY};">שלום ${escapeHtml(name)},</h2>
    <p style="margin:0 0 10px;">שמחים לצרף אותך לנבחרת המארחים שלנו!</p>
    <p style="margin:0 0 4px;">כדי להשלים את התהליך ולהפעיל את החשבון, כל מה שצריך לעשות זה ללחוץ על הכפתור כאן למטה:</p>
    ${button(verifyUrl, 'אימות האימייל שלי')}
    <div style="background:#faf7ef;border:1px solid #efe7d2;border-radius:10px;padding:12px 16px;margin-top:8px;">
      <p style="margin:0;font-size:14px;">💡 <strong>שים לב:</strong> אם קריאת המייל ואימות החשבון מתבצעים ממכשיר שונה
      מזה שנרשמת בו, תועבר לדף ההתחברות – שם יש להזין מחדש את פרטי הגישה שלך.</p>
    </div>
    <p style="margin:18px 0 0;font-size:13px;color:#8a8a8a;">אם לא ביקשת להירשם, אפשר להתעלם מהודעה זו.</p>
  `);

  return sendMail({ to, subject, text, html });
}

// ───────────────────────── 1ב. איפוס סיסמה ─────────────────────────
export async function sendPasswordResetEmail({ to, fullName, resetUrl }) {
  const name = firstName(fullName);
  const subject = 'איפוס הסיסמה שלך באתר דירות נופש';
  const text = `היי${name ? ' ' + name : ''},

קיבלנו בקשה לאיפוס הסיסמה לחשבון שלך.

כדי לבחור סיסמה חדשה ולהתחבר מחדש, לחץ על הקישור הבא:
${resetUrl}

הקישור תקף ל-24 השעות הקרובות בלבד. אם לא ביקשת לאפס את הסיסמה, אפשר פשוט להתעלם מהמייל הזה והסיסמה הנוכחית שלך תישאר ללא שינוי.

המשך יום נעים,
צוות ${BRAND}
מרוויחים כשהבית פנוי.`;

  const html = layout(`
    <h2 style="margin:0 0 12px;color:${NAVY};">היי${name ? ' ' + escapeHtml(name) : ''},</h2>
    <p style="margin:0 0 10px;">קיבלנו בקשה לאיפוס הסיסמה לחשבון שלך.</p>
    <p style="margin:0 0 4px;">כדי לבחור סיסמה חדשה ולהתחבר מחדש, לחץ על הכפתור הבא:</p>
    ${button(resetUrl, 'איפוס סיסמה')}
    <p style="margin:8px 0 0;font-size:14px;color:#555;">הקישור תקף ל-24 השעות הקרובות בלבד. אם לא ביקשת
    לאפס את הסיסמה, אפשר פשוט להתעלם מהמייל הזה והסיסמה הנוכחית שלך תישאר ללא שינוי.</p>
    <p style="margin:18px 0 0;">המשך יום נעים,<br/>צוות ${BRAND}</p>
  `);

  return sendMail({ to, subject, text, html });
}

// ───────────────────────── 2. ברוכים הבאים ─────────────────────────
export async function sendWelcomeEmail({ to, fullName }) {
  void fullName;
  const subject = 'ברוכים הבאים ל"דירות נופש"! 🏡 הדרך הקלה למנף את הבית שלכם';
  const text = `שלום וברכה,

איזה כיף לראות אותך איתנו! שמחים שהצטרפת למשפחת "דירות נופש" – הפלטפורמה שמסייעת לכם לייצר הכנסה נוספת מהנכס שלכם, בקלות ובזמן שהכי נוח לכם.

אנו מאחלים לכם חוויה יעילה, נוחה והרבה הצלחה במינוף הנכס!

בברכה,
צוות "דירות נופש"
Tivuch.shabat@gmail.com`;

  const html = layout(`
    <h2 style="margin:0 0 12px;color:${NAVY};">שלום וברכה,</h2>
    <p style="margin:0 0 10px;">איזה כיף לראות אותך איתנו! שמחים שהצטרפת למשפחת <strong>"דירות נופש"</strong> –
    הפלטפורמה שמסייעת לכם לייצר הכנסה נוספת מהנכס שלכם, בקלות ובזמן שהכי נוח לכם.</p>
    <p style="margin:0 0 10px;">אנו מאחלים לכם חוויה יעילה, נוחה והרבה הצלחה במינוף הנכס!</p>
    <p style="margin:18px 0 0;">בברכה,<br/>צוות "דירות נופש"<br/>
      <a href="mailto:Tivuch.shabat@gmail.com" style="color:${GOLD};">Tivuch.shabat@gmail.com</a>
    </p>
  `);

  return sendMail({ to, subject, text, html });
}

// ───────────────────────── 3. אישור תשלום/הזמנה ─────────────────────────
export async function sendPaymentReceiptEmail({ to, order }) {
  const {
    number,
    date,
    items = [],
    total,
    paymentMethod = 'תשלום מאובטח בכרטיס אשראי',
    billing = {},
  } = order || {};

  const subject = `אישור קבלת הזמנה מס' ${number} – ${BRAND}`;

  const itemsText = items
    .map((it) => `${it.name} x${it.qty} — ₪${Number(it.price).toFixed(2)}`)
    .join('\n');
  const text = `שלום ${billing.name || ''},

שמחים לעדכן כי הזמנתך מאתר "${BRAND}" התקבלה בהצלחה ומטופלת כעת על ידי הצוות שלנו.

פירוט ההזמנה (מס' ${number}) – ${date}
${itemsText}
סך הכל: ₪${Number(total).toFixed(2)}
אמצעי תשלום: ${paymentMethod}

פרטי חיוב
שם מלא: ${billing.name || ''}
כתובת: ${billing.address || ''}
דוא"ל: ${billing.email || ''}

בברכה,
${BRAND} – ${TAGLINE}`;

  const itemsRows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;">${escapeHtml(it.name)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${escapeHtml(it.qty)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:left;">₪${Number(it.price).toFixed(2)}</td>
      </tr>`,
    )
    .join('');

  const html = layout(`
    <h2 style="margin:0 0 12px;color:${NAVY};">שלום ${escapeHtml(billing.name || '')},</h2>
    <p style="margin:0 0 10px;">שמחים לעדכן כי הזמנתך מאתר <strong>"${BRAND}"</strong> התקבלה בהצלחה
    ומטופלת כעת על ידי הצוות שלנו.</p>

    <h3 style="margin:18px 0 8px;color:${NAVY};">פירוט ההזמנה (מס' ${escapeHtml(number)}) – ${escapeHtml(date)}</h3>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;font-family:${FONT_STACK};">
      <tr style="background:#faf7ef;">
        <th style="padding:8px 10px;text-align:right;">מוצר</th>
        <th style="padding:8px 10px;text-align:center;">כמות</th>
        <th style="padding:8px 10px;text-align:left;">מחיר</th>
      </tr>
      ${itemsRows}
      <tr>
        <td colspan="2" style="padding:8px 10px;text-align:right;">סכום ביניים:</td>
        <td style="padding:8px 10px;text-align:left;">₪${Number(total).toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:8px 10px;text-align:right;">אמצעי תשלום:</td>
        <td style="padding:8px 10px;text-align:left;">${escapeHtml(paymentMethod)}</td>
      </tr>
      <tr style="font-weight:800;color:${NAVY};">
        <td colspan="2" style="padding:10px;text-align:right;border-top:2px solid #ece6d8;">סך הכל:</td>
        <td style="padding:10px;text-align:left;border-top:2px solid #ece6d8;">₪${Number(total).toFixed(2)}</td>
      </tr>
    </table>

    <div style="background:#faf7ef;border:1px solid #efe7d2;border-radius:10px;padding:12px 16px;margin-top:16px;">
      <p style="margin:0 0 4px;font-weight:700;color:${NAVY};">פרטי חיוב</p>
      <p style="margin:2px 0;">שם מלא: ${escapeHtml(billing.name || '')}</p>
      <p style="margin:2px 0;">כתובת: ${escapeHtml(billing.address || '')}</p>
      <p style="margin:2px 0;">דוא"ל: <span dir="ltr">${escapeHtml(billing.email || '')}</span></p>
    </div>
  `);

  return sendMail({ to, subject, text, html });
}

// ───────────────────────── 4. המודעה פורסמה ("גלויה לכולם") ─────────────────────────
export async function sendListingLiveEmail({ to, apartment, listingUrl, editUrl }) {
  const title = apartment?.title || 'הדירה שלך';
  const subject = 'המודעה שלך באתר דירות נופש! ✨';
  const text = `מהרגע זה המודעה שלך גלויה וזמינה לצפייה עבור כולם.

רוצה לראות איך היא נראית?
${listingUrl}

לעריכת פרטי הדירה:
${editUrl}

${BRAND} – ${TAGLINE}`;

  const html = layout(`
    <h2 style="margin:0 0 12px;color:${NAVY};">המודעה שלך באוויר! ✨</h2>
    <p style="margin:0 0 6px;">מהרגע זה המודעה <strong>"${escapeHtml(title)}"</strong> גלויה וזמינה לצפייה עבור כולם.</p>
    <p style="margin:0 0 4px;">רוצה לראות איך היא נראית?</p>
    ${button(listingUrl, 'צפייה במודעה')}
    <p style="margin:12px 0 4px;">רוצה לעדכן פרטים?</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0;">
      <tr>
        <td style="border-radius:10px;border:2px solid ${GOLD};">
          <a href="${editUrl}" target="_blank"
             style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;
                    font-family:${FONT_STACK};
                    color:${GOLD};text-decoration:none;">
            עריכת פרטי הדירה
          </a>
        </td>
      </tr>
    </table>
  `);

  return sendMail({ to, subject, text, html });
}

// ───────────────────────── 5. תזכורת לפני פקיעת תוקף ─────────────────────────
// נשלחת פעמיים: 7 ימים לפני הפקיעה, ושוב יום לפני (תזכורת אחרונה) אם לא חודשה.
export async function sendListingExpiryReminderEmail({
  to,
  fullName,
  apartment,
  renewUrl,
  expiryDate,
  daysLeft = 7,
}) {
  const name = firstName(fullName);
  const title = apartment?.title || 'המודעה שלך';
  const isFinal = Number(daysLeft) <= 1;
  const whenPhrase = isFinal ? 'מחר' : `בעוד כ-${Number(daysLeft) || 7} ימים`;
  const dateText = expiryDate ? ` (בתאריך ${expiryDate})` : '';

  const subject = isFinal
    ? 'תזכורת אחרונה: המודעה שלך יורדת מחר! ⏳'
    : 'המודעה שלך עומדת לפוג בקרוב! זה הזמן לחדש';

  const text = `היי${name ? ' ' + name : ''},

רצינו לעדכן שהמודעה של הדירה שלך באתר "${BRAND}" תרד מהאוויר ${whenPhrase}${dateText}.

העונה החמה והחגים כבר ממש מעבר לפינה, ויש ביקוש גדול מאוד לדירות נופש! חבל לפספס פניות מלקוחות רלוונטיים.

כדי להשאיר את המודעה פעילה ולהמשיך לקבל פניות, היכנס עכשיו לחשבון שלך וחדש את תוקף הפרסום בקליק:
${renewUrl}

נשארנו כאן לכל שאלה,
צוות ${BRAND}
מרוויחים כשהבית פנוי.`;

  const html = layout(`
    <h2 style="margin:0 0 12px;color:${NAVY};">היי${name ? ' ' + escapeHtml(name) : ''},</h2>
    <p style="margin:0 0 10px;">רצינו לעדכן שהמודעה של הדירה שלך באתר <strong>"${BRAND}"</strong>
    תרד מהאוויר <strong>${whenPhrase}</strong>${escapeHtml(dateText)}.</p>
    <div style="background:#faf7ef;border:1px solid #efe7d2;border-radius:10px;padding:12px 16px;margin:12px 0;">
      <p style="margin:0;font-weight:700;color:${NAVY};">${escapeHtml(title)}</p>
    </div>
    <p style="margin:0 0 10px;">העונה החמה והחגים כבר ממש מעבר לפינה, ויש ביקוש גדול מאוד לדירות נופש!
    חבל לפספס פניות מלקוחות רלוונטיים.</p>
    <p style="margin:0 0 4px;">כדי להשאיר את המודעה פעילה ולהמשיך לקבל פניות, היכנס עכשיו לחשבון שלך
    וחדש את תוקף הפרסום בקליק:</p>
    ${button(renewUrl, 'לחידוש המודעה שלי')}
    <p style="margin:18px 0 0;">נשארנו כאן לכל שאלה,<br/>צוות ${BRAND}</p>
  `);

  return sendMail({ to, subject, text, html });
}

// ───────────────────────── פנייה ישירה מהמודעה (לבעל הנכס) ─────────────────────────
export async function sendListingInquiryEmail({
  to,
  ownerName,
  apartment,
  senderEmail,
  message,
  listingUrl,
}) {
  const name = firstName(ownerName);
  const title = apartment?.title || 'הדירה שלך';
  const subject = `פנייה חדשה למודעה "${title}" – ${BRAND}`;

  const text = `שלום${name ? ' ' + name : ''},

קיבלת פנייה חדשה לגבי המודעה שלך "${title}" באתר ${BRAND}.

כתובת המייל של הפונה (אפשר להשיב ישירות): ${senderEmail}

תוכן ההודעה:
${message}

${listingUrl ? `צפייה במודעה: ${listingUrl}\n` : ''}
ניתן להשיב לפנייה ישירות במענה למייל הזה.

בברכה,
צוות ${BRAND}
${TAGLINE}`;

  const html = layout(`
    <h2 style="margin:0 0 12px;color:${NAVY};">קיבלת פנייה חדשה! ✉️</h2>
    <p style="margin:0 0 10px;">שלום${name ? ' ' + escapeHtml(name) : ''}, התקבלה פנייה חדשה לגבי המודעה שלך
    <strong>"${escapeHtml(title)}"</strong>.</p>

    <div style="background:#faf7ef;border:1px solid #efe7d2;border-radius:10px;padding:14px 18px;margin:14px 0;">
      <p style="margin:0 0 6px;font-weight:700;color:${NAVY};">פרטי הפונה</p>
      <p style="margin:2px 0;">מייל לתגובה: <a href="mailto:${escapeHtml(senderEmail)}" dir="ltr" style="color:${GOLD};">${escapeHtml(senderEmail)}</a></p>
    </div>

    <p style="margin:0 0 6px;font-weight:700;color:${NAVY};">תוכן ההודעה:</p>
    <div style="background:#ffffff;border:1px solid #ece6d8;border-radius:10px;padding:14px 18px;margin:0 0 14px;white-space:pre-wrap;">${escapeHtml(message)}</div>

    ${listingUrl ? button(listingUrl, 'צפייה במודעה') : ''}

    <p style="margin:14px 0 0;font-size:14px;color:#555;">💡 ניתן להשיב לפנייה פשוט על ידי <strong>מענה (Reply)</strong>
    למייל הזה — התשובה תגיע ישירות לפונה.</p>
    <p style="margin:18px 0 0;">בברכה,<br/>צוות ${BRAND}</p>
  `);

  return sendMail({ to, subject, text, html, replyTo: senderEmail });
}

// ───────────────────────── 6א. אישור קבלת פנייה (לפונה) ─────────────────────────
export async function sendContactConfirmationEmail({ to, fullName }) {
  const name = firstName(fullName);
  const subject = 'פנייתך התקבלה במערכת ✉️';
  const text = `שלום ${name},

תודה שפנית אלינו. פנייתך התקבלה במערכת.

אנו עושים את מירב המאמצים כדי להעניק שירות מהיר ומקצועי, ונשתדל לחזור אליך עם מענה מפורט ב-24 השעות הקרובות.

💡 מידע שימושי בזמן ההמתנה: אם פנייתך נוגעת לדירה ספציפית המפורסמת באתר, מומלץ לשלוח הודעה ישירה למארח דרך כפתור "יצירת קשר עם המפרסם" בגוף המודעה לקבלת מענה מהיר.

בברכה,
צוות ${BRAND}
${TAGLINE}`;

  const html = layout(`
    <h2 style="margin:0 0 12px;color:${NAVY};">שלום ${escapeHtml(name)},</h2>
    <p style="margin:0 0 10px;">תודה שפנית אלינו. פנייתך התקבלה במערכת.</p>
    <p style="margin:0 0 10px;">אנו עושים את מירב המאמצים כדי להעניק שירות מהיר ומקצועי,
    ונשתדל לחזור אליך עם מענה מפורט ב-24 השעות הקרובות.</p>
    <div style="background:#faf7ef;border:1px solid #efe7d2;border-radius:10px;padding:12px 16px;margin-top:8px;">
      <p style="margin:0;font-size:14px;">💡 <strong>מידע שימושי בזמן ההמתנה:</strong> אם פנייתך נוגעת לדירה
      ספציפית המפורסמת באתר, מומלץ לשלוח הודעה ישירה למארח דרך כפתור "יצירת קשר עם המפרסם"
      בגוף המודעה לקבלת מענה מהיר.</p>
    </div>
    <p style="margin:18px 0 0;">בברכה,<br/>צוות ${BRAND}</p>
  `);

  return sendMail({ to, subject, text, html });
}

// ───────────────────────── 6ב. פנייה חדשה (למנהל) ─────────────────────────
export async function sendContactToAdmin({ to, contact }) {
  const { full_name, email, phone, message } = contact || {};
  const subject = `📩 פנייה חדשה מ${full_name || 'מבקר באתר'} – ${BRAND}`;
  const text = `התקבלה פנייה חדשה דרך טופס "צור קשר":

שם: ${full_name || ''}
אימייל: ${email || ''}
טלפון: ${phone || 'לא צוין'}

הודעה:
${message || ''}`;

  const html = layout(`
    <h2 style="margin:0 0 12px;color:${NAVY};">📩 פנייה חדשה מטופס "צור קשר"</h2>
    <div style="background:#faf7ef;border:1px solid #efe7d2;border-radius:10px;padding:12px 16px;margin:12px 0;">
      <p style="margin:2px 0;"><strong>שם:</strong> ${escapeHtml(full_name || '')}</p>
      <p style="margin:2px 0;"><strong>אימייל:</strong> <span dir="ltr">${escapeHtml(email || '')}</span></p>
      <p style="margin:2px 0;"><strong>טלפון:</strong> <span dir="ltr">${escapeHtml(phone || 'לא צוין')}</span></p>
    </div>
    <p style="margin:0 0 4px;font-weight:700;color:${NAVY};">הודעה:</p>
    <p style="margin:0;white-space:pre-wrap;">${escapeHtml(message || '')}</p>
  `);

  return sendMail({ to, subject, text, html });
}

// שני כפתורים זה לצד זה במייל (CTA ראשי + משני)
function buttonPair(primaryHref, primaryLabel, secondaryHref, secondaryLabel) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
      <tr>
        <td style="border-radius:10px;background:${GOLD};">
          <a href="${primaryHref}" target="_blank"
             style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;
                    font-family:${FONT_STACK};
                    color:#ffffff;text-decoration:none;border-radius:10px;">${primaryLabel}</a>
        </td>
        <td style="width:12px;"></td>
        <td style="border-radius:10px;border:2px solid ${NAVY};">
          <a href="${secondaryHref}" target="_blank"
             style="display:inline-block;padding:11px 24px;font-size:15px;font-weight:700;
                    font-family:${FONT_STACK};
                    color:${NAVY};text-decoration:none;">${secondaryLabel}</a>
        </td>
      </tr>
    </table>`;
}

// מייל למנהל כאשר מתפרסמת דירה חדשה הממתינה לאישור
export async function sendNewListingToAdmin({
  to,
  apartment,
  publisherName,
  publisherPhone,
  publisherEmail,
  approveUrl,
  adminPanelUrl,
}) {
  const title = apartment.title || 'דירה חדשה';
  const subject = '🔔 התראה: מודעה חדשה לאישור';
  const fullName = publisherName || apartment.owner_name || 'משתמש';
  const phone = publisherPhone || apartment.owner_phone || 'לא צוין';
  const userEmail = publisherEmail || apartment.owner_email || 'לא צוין';
  const description = apartment.description || title;
  const images = Array.isArray(apartment.images) ? apartment.images.filter(Boolean).slice(0, 4) : [];

  const text = `היי,

התקבלה פעולה חדשה באתר הממתינה לאישורך. להלן הפרטים שהוזנו:

שם מלא: ${fullName}
טלפון: ${phone}
אימייל: ${userEmail}
פרטי הפנייה / תיאור הנכס: ${description}

${approveUrl ? `לאישור ופרסום בקליק: ${approveUrl}\n` : ''}${adminPanelUrl ? `למעבר לפאנל הניהול: ${adminPanelUrl}\n` : ''}
${BRAND}
מרוויחים כשהבית פנוי`;

  const imagesHtml = images.length
    ? `<p style="margin:14px 0 6px;font-weight:700;color:${NAVY};">📸 תמונות שצורפו:</p>
       <div style="margin:0 0 6px;">
         ${images
           .map(
             (url) =>
               `<img src="${escapeHtml(url)}" alt="תמונת נכס"
                  style="width:120px;height:90px;object-fit:cover;border-radius:8px;
                         border:1px solid #ece6d8;margin:0 6px 6px 0;" />`,
           )
           .join('')}
       </div>`
    : '';

  const ctaHtml =
    approveUrl && adminPanelUrl
      ? buttonPair(approveUrl, 'לאישור ופרסום בקליק', adminPanelUrl, 'למעבר לפאנל הניהול')
      : adminPanelUrl
        ? button(adminPanelUrl, 'למעבר לפאנל הניהול')
        : '';

  const html = layout(`
    <h2 style="margin:0 0 12px;color:${GOLD};">🔔 התראה: מודעה חדשה לאישור</h2>
    <p style="margin:0 0 12px;">היי, התקבלה פעולה חדשה באתר הממתינה לאישורך. להלן הפרטים שהוזנו:</p>
    <div style="background:#faf7ef;border:1px solid #efe7d2;border-radius:10px;padding:14px 18px;margin:0 0 12px;">
      <p style="margin:2px 0;"><strong>שם מלא:</strong> ${escapeHtml(fullName)}</p>
      <p style="margin:2px 0;"><strong>טלפון:</strong> <span dir="ltr">${escapeHtml(phone)}</span></p>
      <p style="margin:2px 0;"><strong>אימייל:</strong> <span dir="ltr">${escapeHtml(userEmail)}</span></p>
      <p style="margin:8px 0 2px;"><strong>פרטי הפנייה / תיאור הנכס:</strong></p>
      <p style="margin:0;white-space:pre-wrap;">${escapeHtml(description)}</p>
    </div>
    ${imagesHtml}
    ${ctaHtml}
  `);

  return sendMail({ to, subject, text, html });
}
