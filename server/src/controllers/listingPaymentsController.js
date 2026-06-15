import { sendPaymentReceiptEmail } from '../utils/mailer.js';
import { getPlanAmount, isPremiumApartment } from '../config/pricing.js';
import { updateApartmentExpiryFromPayment } from '../models/apartmentModel.js';
import {
  insertListingPaymentRow,
  selectAllListingPaymentsAdmin,
  selectApartmentByIdForListing,
  selectListingPaymentById,
  selectMineListingPayments,
} from '../models/listingPaymentModel.js';
import { selectUserBillingById } from '../models/userModel.js';

const LISTING_FEE_PER_MONTH = 30;

function formatHebrewDate(date) {
  try {
    return new Intl.DateTimeFormat('he-IL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export async function createListingPayment(req, res) {
  const {
    apartment_id,
    months = 1,
    tier: requestedTier = 'standard',
    provider = 'manual',
    provider_reference = null,
  } = req.body || {};

  if (!apartment_id) {
    return res.status(400).json({ error: 'נדרש מזהה דירה (apartment_id)' });
  }
  const monthsInt = Math.max(1, Number(months) || 1);

  const apt = await selectApartmentByIdForListing(apartment_id);
  if (!apt) {
    return res.status(404).json({ error: 'דירה לא נמצאה' });
  }
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && apt.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'אין הרשאה לשלם עבור דירה זו' });
  }

  const tier = isPremiumApartment(apt) || requestedTier === 'premium' ? 'premium' : 'standard';
  const amount = getPlanAmount(tier, monthsInt);
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + monthsInt);

  const paymentInsertId = await insertListingPaymentRow([
    apartment_id,
    req.user.id,
    amount,
    monthsInt,
    provider,
    provider_reference,
    periodStart.toISOString().slice(0, 10),
    periodEnd.toISOString().slice(0, 10),
  ]);

  const payment = await selectListingPaymentById(paymentInsertId);

  await updateApartmentExpiryFromPayment({
    apartmentId: apartment_id,
    periodEnd,
    wasExpired: apt.status === 'expired',
  });

  (async () => {
    try {
      const u = await selectUserBillingById(req.user.id);
      const billingName = apt.owner_name || u?.full_name || '';
      const billingEmail = u?.email || apt.owner_email || req.user.email;
      const billingAddress = [apt.address, apt.location].filter(Boolean).join(', ');
      if (!billingEmail) return;

      await sendPaymentReceiptEmail({
        to: billingEmail,
        order: {
          number: String(10000 + payment.id),
          date: formatHebrewDate(periodStart),
          items: [
            {
              name: `מנוי פרסום מודעה${tier === 'premium' ? ' (מתחם אירוח)' : ''} – ${monthsInt} ${monthsInt === 1 ? 'חודש' : 'חודשים'}`,
              qty: 1,
              price: amount,
            },
          ],
          total: amount,
          paymentMethod: 'תשלום מאובטח בכרטיס אשראי',
          billing: { name: billingName, address: billingAddress, email: billingEmail },
        },
      });
    } catch (err) {
      console.error('[mailer] מייל אישור תשלום נכשל:', err.message);
    }
  })();

  res.status(201).json(payment);
}

export async function listMineListingPayments(req, res) {
  const rows = await selectMineListingPayments(req.user.id);
  res.json(rows);
}

export async function listAllListingPaymentsAdmin(_req, res) {
  const rows = await selectAllListingPaymentsAdmin();
  res.json(rows);
}

export function getListingFee(_req, res) {
  res.json({ amount_per_month: LISTING_FEE_PER_MONTH, currency: 'ILS' });
}
