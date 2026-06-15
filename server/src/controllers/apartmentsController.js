import { APARTMENT_EDITABLE_FIELDS } from '../utils/mapApartment.js';
import {
  attachImagesToApartment,
  attachImagesToApartments,
  apartmentExists,
  approveApartmentRow,
  deleteApartmentById,
  deleteApartmentImages,
  insertApartmentImagesRows,
  insertApartmentPending,
  rejectApartmentRow,
  selectApartmentById,
  selectApprovedApartments,
  selectMineApartments,
  selectPendingApartments,
  updateApartmentDynamic,
} from '../models/apartmentModel.js';
import { signApproveToken, verifyApproveToken } from '../middlewares/auth.js';
import {
  sendNewListingToAdmin,
  sendListingLiveEmail,
  sendListingInquiryEmail,
} from '../utils/mailer.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { getPublicApiBase, getWebAppBaseForLinks } from '../config/publicUrls.js';
import {
  selectAdminEmailsFromDb,
  selectUserContactById,
  selectUserPublisherFields,
} from '../models/userModel.js';

const PUBLIC_API_URL = getPublicApiBase();

function absoluteImageUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = getWebAppBaseForLinks();
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function resolveOwnerContact(apt) {
  let ownerEmail = apt.owner_email || null;
  let ownerName = apt.owner_name || null;
  if (apt.owner_id) {
    const u = await selectUserContactById(apt.owner_id);
    if (u) {
      ownerEmail = ownerEmail || u.email;
      ownerName = ownerName || u.full_name;
    }
  }
  return { ownerEmail, ownerName };
}

async function getAdminEmails() {
  if (process.env.ADMIN_NOTIFY_EMAIL) {
    return process.env.ADMIN_NOTIFY_EMAIL.split(',').map((e) => e.trim()).filter(Boolean);
  }
  const emails = await selectAdminEmailsFromDb();
  return emails.filter((email) => !email.endsWith('.local'));
}

export async function listPublic(_req, res) {
  const rows = await selectApprovedApartments();
  const apartments = await attachImagesToApartments(rows);
  res.json(apartments);
}

export async function listMine(req, res) {
  const email = String(req.user.email || '').trim().toLowerCase();
  const rows = await selectMineApartments(req.user.id, email);
  res.json(await attachImagesToApartments(rows));
}

export async function listPending(_req, res) {
  const rows = await selectPendingApartments();
  res.json(await attachImagesToApartments(rows));
}

export async function getById(req, res) {
  const apt = await selectApartmentById(req.params.id);
  if (!apt) {
    return res.status(404).json({ error: 'דירה לא נמצאה' });
  }

  if (apt.status !== 'approved') {
    const isOwner = req.user && apt.owner_id && req.user.id === apt.owner_id;
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(404).json({ error: 'דירה לא נמצאה' });
    }
  }

  const apartment = await attachImagesToApartment(apt);
  const { ownerEmail } = await resolveOwnerContact(apt);
  apartment.can_inquire = apt.status === 'approved' && !!ownerEmail;
  res.json(apartment);
}

export async function postInquiry(req, res) {
  const { email, message } = req.body || {};

  if (!email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'יש למלא כתובת מייל ותוכן הודעה' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'כתובת אימייל לא תקינה' });
  }
  if (String(message).trim().length < 10) {
    return res.status(400).json({ error: 'ההודעה קצרה מדי' });
  }

  const aptId = Number(req.params.id);
  if (!Number.isFinite(aptId) || aptId <= 0) {
    return res.status(400).json({ error: 'מזהה דירה לא תקין' });
  }

  const apt = await selectApartmentById(aptId);
  if (!apt) {
    return res.status(404).json({ error: 'דירה לא נמצאה' });
  }

  if (apt.status !== 'approved') {
    return res.status(400).json({
      error: 'ניתן לשלוח הודעה רק למודעות שאושרו ופורסמו באתר',
    });
  }

  const { ownerEmail, ownerName } = await resolveOwnerContact(apt);

  if (!ownerEmail) {
    return res.status(422).json({
      error: 'לבעל הנכס אין כתובת מייל במערכת. נסו ליצור קשר בטלפון או בוואטסאפ',
    });
  }

  const senderEmail = email.trim().toLowerCase();
  try {
    await sendListingInquiryEmail({
      to: ownerEmail,
      ownerName,
      apartment: apt,
      senderEmail,
      message: message.trim(),
      listingUrl: `${getWebAppBaseForLinks()}/apartments/${apt.id}`,
    });
  } catch (err) {
    console.error('[mailer] מייל פנייה לבעל הנכס נכשל:', err.message);
    return res.status(502).json({ error: 'שליחת ההודעה נכשלה. נסו שוב מאוחר יותר.' });
  }

  res.status(201).json({ ok: true, message: 'ההודעה נשלחה לבעל הנכס בהצלחה' });
}

export async function create(req, res) {
  const body = req.body || {};

  const required = ['title', 'location', 'price_per_night'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return res.status(400).json({ error: `השדה "${field}" חובה` });
    }
  }

  const images = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
  const coverImage = body.image_url || images[0] || null;

  const insertId = await insertApartmentPending({
    owner_id: req.user.id,
    title: body.title,
    description: body.description,
    location: body.location,
    address: body.address,
    property_type: body.property_type,
    rental_period: body.rental_period,
    price_per_night: body.price_per_night,
    bedrooms: body.bedrooms,
    bathrooms: body.bathrooms,
    max_guests: body.max_guests,
    image_url: coverImage,
    owner_name: body.owner_name,
    owner_phone: body.owner_phone,
    owner_email: body.owner_email,
    contact_via_whatsapp: body.contact_via_whatsapp,
    is_available: body.is_available,
  });

  if (images.length > 0) {
    const values = images.map((url, idx) => [insertId, url, idx]);
    await insertApartmentImagesRows(values);
  }

  const row = await selectApartmentById(insertId);
  const apartment = await attachImagesToApartment(row);

  (async () => {
    try {
      const adminEmails = await getAdminEmails();
      if (adminEmails.length === 0) return;

      let publisherName = body.owner_name || null;
      let publisherEmail = body.owner_email || null;
      let publisherPhone = body.owner_phone || null;
      if (!publisherName || !publisherEmail) {
        const u = await selectUserPublisherFields(req.user.id);
        publisherName = publisherName || u?.full_name || req.user.email;
        publisherEmail = publisherEmail || u?.email || req.user.email;
        publisherPhone = publisherPhone || u?.phone || null;
      }

      const approveToken = signApproveToken({ id: apartment.id });
      const approveUrl = `${PUBLIC_API_URL}/apartments/${apartment.id}/email-approve?token=${encodeURIComponent(approveToken)}`;
      const adminPanelUrl = `${getWebAppBaseForLinks()}/admin`;

      const emailApartment = {
        ...apartment,
        images: (apartment.images || []).map(absoluteImageUrl).filter(Boolean),
      };

      await sendNewListingToAdmin({
        to: adminEmails.join(', '),
        apartment: emailApartment,
        publisherName,
        publisherPhone,
        publisherEmail,
        approveUrl,
        adminPanelUrl,
      });
    } catch (err) {
      console.error('[mailer] התראת דירה חדשה למנהל נכשלה:', err.message);
    }
  })();

  res.status(201).json(apartment);
}

async function loadOwnedApartment(req, res) {
  const apt = await selectApartmentById(req.params.id);
  if (!apt) {
    res.status(404).json({ error: 'דירה לא נמצאה' });
    return null;
  }
  const isAdmin = req.user.role === 'admin';
  const isOwner = apt.owner_id === req.user.id;
  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: 'אין הרשאה לערוך את הדירה' });
    return null;
  }
  return apt;
}

export async function update(req, res) {
  const apt = await loadOwnedApartment(req, res);
  if (!apt) return;

  const body = req.body || {};
  const updates = [];
  const values = [];

  for (const field of APARTMENT_EDITABLE_FIELDS) {
    if (body[field] === undefined) continue;
    let value = body[field];
    if (field === 'contact_via_whatsapp' || field === 'is_available') {
      value = value ? 1 : 0;
    }
    if (field === 'price_per_night') value = Number(value);
    if (['bedrooms', 'bathrooms', 'max_guests'].includes(field)) value = Number(value) || 0;
    updates.push(`${field} = ?`);
    values.push(value);
  }

  if (Array.isArray(body.images)) {
    const images = body.images.filter(Boolean);
    await deleteApartmentImages(req.params.id);
    if (images.length > 0) {
      const inserts = images.map((url, idx) => [req.params.id, url, idx]);
      await insertApartmentImagesRows(inserts);
    }
    if (!body.image_url) {
      updates.push('image_url = ?');
      values.push(images[0] || null);
    }
  }

  if (updates.length === 0 && !Array.isArray(body.images)) {
    return res.status(400).json({ error: 'אין שדות לעדכון' });
  }

  if (req.user.role !== 'admin' && apt.status === 'approved' && updates.length > 0) {
    updates.push('status = ?');
    values.push('pending');
    updates.push('approved_at = NULL');
  }

  if (updates.length > 0) {
    values.push(req.params.id);
    await updateApartmentDynamic(updates, values);
  }

  const updated = await selectApartmentById(req.params.id);
  res.json(await attachImagesToApartment(updated));
}

export async function remove(req, res) {
  const apt = await loadOwnedApartment(req, res);
  if (!apt) return;
  await deleteApartmentById(req.params.id);
  res.status(204).end();
}

async function approveApartmentById(id) {
  const exists = await apartmentExists(id);
  if (!exists) return null;

  await approveApartmentRow(id);
  const row = await selectApartmentById(id);
  const apartment = await attachImagesToApartment(row);

  (async () => {
    try {
      const { ownerEmail, ownerName } = await resolveOwnerContact(apartment);
      if (!ownerEmail) return;
      await sendListingLiveEmail({
        to: ownerEmail,
        ownerName,
        apartment,
        listingUrl: `${getWebAppBaseForLinks()}/apartments/${apartment.id}`,
        editUrl: `${getWebAppBaseForLinks()}/my-apartments/${apartment.id}/edit`,
      });
    } catch (err) {
      console.error('[mailer] מייל "המודעה פורסמה" נכשל:', err.message);
    }
  })();

  return apartment;
}

export async function approve(req, res) {
  const apartment = await approveApartmentById(req.params.id);
  if (!apartment) {
    return res.status(404).json({ error: 'דירה לא נמצאה' });
  }
  res.json(apartment);
}

export async function emailApprove(req, res) {
  const renderPage = (title, body) =>
    res.type('html').send(`<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f4f1ea;text-align:center;padding:48px 16px;">
<div style="max-width:440px;margin:0 auto;background:#fff;border:1px solid #ece6d8;border-radius:16px;padding:32px 24px;">
${body}</div></body></html>`);

  const { token } = req.query;
  if (!token) {
    return res.status(400).send('חסר טוקן אישור');
  }

  let decoded;
  try {
    decoded = verifyApproveToken(token);
  } catch {
    return renderPage(
      'קישור לא תקין',
      `<h2 style="color:#b8860b;">הקישור אינו תקין או שפג תוקפו</h2>
         <p>ניתן להיכנס לפאנל הניהול ולאשר את המודעה ידנית.</p>
         <a href="${getWebAppBaseForLinks()}/admin" style="color:#1a2b4a;font-weight:700;">למעבר לפאנל הניהול</a>`,
    );
  }

  if (String(decoded.id) !== String(req.params.id)) {
    return res.status(400).send('טוקן אינו תואם למודעה');
  }

  const apartment = await approveApartmentById(req.params.id);
  if (!apartment) {
    return renderPage('המודעה לא נמצאה', `<h2>המודעה לא נמצאה</h2>`);
  }

  const safeTitle = escapeHtml(apartment.title);
  return renderPage(
    'המודעה אושרה',
    `<h2 style="color:#237804;">✅ המודעה אושרה ופורסמה!</h2>
       <p>"${safeTitle}" גלויה כעת לכולם.</p>
       <a href="${getWebAppBaseForLinks()}/apartments/${Number(apartment.id)}"
          style="display:inline-block;margin-top:8px;padding:12px 26px;background:#b8860b;color:#fff;
                 border-radius:10px;text-decoration:none;font-weight:700;">צפייה במודעה</a>
       <p style="margin-top:14px;"><a href="${getWebAppBaseForLinks()}/admin" style="color:#1a2b4a;">לפאנל הניהול</a></p>`,
  );
}

export async function reject(req, res) {
  if (!(await apartmentExists(req.params.id))) {
    return res.status(404).json({ error: 'דירה לא נמצאה' });
  }
  const reason = (req.body && req.body.reason) || null;
  await rejectApartmentRow(req.params.id, reason);
  const row = await selectApartmentById(req.params.id);
  res.json(await attachImagesToApartment(row));
}
