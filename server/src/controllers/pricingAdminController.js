import {
  deletePricingPlan,
  deletePromotionById,
  insertPricingPlan,
  insertPromotion,
  selectAllPricingPlansOrdered,
  selectPlanById,
  selectPlanBySlug,
  selectPlanIdExists,
  selectPlanSlugDuplicate,
  selectPlanExistsById,
  selectPromotionById,
  selectPromotionJoinedById,
  selectPromotionsWithPlanName,
  updatePricingPlanDynamic,
  updatePromotionDynamic,
} from '../models/pricingModel.js';
import {
  PRICING_CATEGORIES,
  PRICING_HIGHLIGHTS,
  PROMOTION_DISCOUNT_TYPES,
  coerceEnum,
} from '../constants/enums.js';
import { HttpError } from '../utils/HttpError.js';

function mapPricingNoTable(e) {
  if (e.code === 'ER_NO_SUCH_TABLE') {
    throw new HttpError(503, 'הריצו db/pricing_tables.sql על מסד הנתונים');
  }
  throw e;
}

function parseFeaturesInput(body) {
  if (Array.isArray(body.features)) return body.features.map((s) => String(s).trim()).filter(Boolean);
  if (typeof body.features_text === 'string') {
    return body.features_text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

// ─── תוכניות ───
export async function listPlans(_req, res) {
  try {
    const rows = await selectAllPricingPlansOrdered();
    res.json(rows);
  } catch (e) {
    mapPricingNoTable(e);
  }
}

export async function createPlan(req, res) {
  const b = req.body || {};
  const slug = String(b.slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');
  if (!slug) return res.status(400).json({ error: 'slug הוא שדה חובה (אנגלית, מספרים ומקף)' });
  if (!b.name?.trim()) return res.status(400).json({ error: 'שם המסלול הוא שדה חובה' });
  const price = Number(b.price);
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'מחיר לא תקין' });
  const category = coerceEnum(b.category, PRICING_CATEGORIES, 'hosts');
  const durationMonths = Math.max(1, parseInt(b.duration_months, 10) || 1);
  const features = parseFeaturesInput(b);
  if (features.length === 0) return res.status(400).json({ error: 'נא להוסיף לפחות תכונה אחת' });

  const compareAt =
    b.compare_at_price != null && b.compare_at_price !== ''
      ? Number(b.compare_at_price)
      : null;
  if (compareAt != null && (!Number.isFinite(compareAt) || compareAt < 0)) {
    return res.status(400).json({ error: 'מחיר השוואה לא תקין' });
  }

  const highlight = coerceEnum(b.highlight_type, PRICING_HIGHLIGHTS, 'none');

  try {
    await insertPricingPlan([
      slug,
      category,
      b.name.trim(),
      b.description?.trim() || null,
      price,
      compareAt,
      (b.currency || 'ILS').trim().slice(0, 8),
      durationMonths,
      b.duration_label?.trim() || null,
      JSON.stringify(features),
      highlight,
      b.badge_text?.trim() || null,
      Number(b.sort_order) || 0,
      b.is_active === false ? 0 : 1,
    ]);
    const row = await selectPlanBySlug(slug);
    res.status(201).json(row);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug כבר קיים' });
    mapPricingNoTable(e);
  }
}

export async function updatePlan(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'מזהה לא תקין' });
  const b = req.body || {};
  if (!(await selectPlanIdExists(id))) return res.status(404).json({ error: 'מסלול לא נמצא' });

  if (b.slug != null) {
    const slug = String(b.slug)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');
    if (!slug) return res.status(400).json({ error: 'slug לא תקין' });
    if (await selectPlanSlugDuplicate(slug, id)) return res.status(409).json({ error: 'slug כבר בשימוש' });
  }

  const fields = [];
  const vals = [];

  const set = (col, val) => {
    fields.push(`${col} = ?`);
    vals.push(val);
  };

  if (b.slug != null) {
    set(
      'slug',
      String(b.slug)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-'),
    );
  }
  if (b.name != null) set('name', String(b.name).trim() || null);
  if (b.description !== undefined) set('description', b.description?.trim() || null);
  if (b.price != null) {
    const price = Number(b.price);
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'מחיר לא תקין' });
    set('price', price);
  }
  if (b.compare_at_price !== undefined) {
    if (b.compare_at_price === null || b.compare_at_price === '') set('compare_at_price', null);
    else {
      const c = Number(b.compare_at_price);
      if (!Number.isFinite(c) || c < 0) return res.status(400).json({ error: 'מחיר השוואה לא תקין' });
      set('compare_at_price', c);
    }
  }
  if (b.currency != null) set('currency', String(b.currency).trim().slice(0, 8));
  if (b.duration_months != null) set('duration_months', Math.max(1, parseInt(b.duration_months, 10) || 1));
  if (b.duration_label !== undefined) set('duration_label', b.duration_label?.trim() || null);
  if (b.features != null || b.features_text != null) {
    const features = parseFeaturesInput(b);
    if (features.length === 0) return res.status(400).json({ error: 'נא להוסיף לפחות תכונה אחת' });
    fields.push('features_json = CAST(? AS JSON)');
    vals.push(JSON.stringify(features));
  }
  if (b.highlight_type != null) {
    set('highlight_type', coerceEnum(b.highlight_type, PRICING_HIGHLIGHTS, 'none'));
  }
  if (b.badge_text !== undefined) set('badge_text', b.badge_text?.trim() || null);
  if (b.sort_order != null) set('sort_order', Number(b.sort_order) || 0);
  if (b.category != null) set('category', coerceEnum(b.category, PRICING_CATEGORIES, 'hosts'));
  if (b.is_active !== undefined) set('is_active', b.is_active ? 1 : 0);

  if (fields.length === 0) return res.status(400).json({ error: 'אין שדות לעדכון' });
  vals.push(id);
  await updatePricingPlanDynamic(fields.join(', '), vals);
  const row = await selectPlanById(id);
  res.json(row);
}

export async function deletePlan(req, res) {
  const id = Number(req.params.id);
  const affected = await deletePricingPlan(id);
  if (affected === 0) return res.status(404).json({ error: 'לא נמצא' });
  res.status(204).send();
}

// ─── מבצעים ───
export async function listPromotions(_req, res) {
  const rows = await selectPromotionsWithPlanName();
  res.json(rows);
}

export async function createPromotion(req, res) {
  const b = req.body || {};
  if (!b.name?.trim()) return res.status(400).json({ error: 'שם המבצע הוא שדה חובה' });
  const dtype = coerceEnum(b.discount_type, PROMOTION_DISCOUNT_TYPES, 'percent');
  const dval = Number(b.discount_value);
  if (!Number.isFinite(dval) || dval < 0) return res.status(400).json({ error: 'ערך הנחה לא תקין' });
  if (dtype === 'percent' && dval > 100) return res.status(400).json({ error: 'אחוז הנחה לא יעלה על 100' });

  const starts = new Date(b.starts_at);
  const ends = new Date(b.ends_at);
  if (Number.isNaN(+starts) || Number.isNaN(+ends)) {
    return res.status(400).json({ error: 'תאריכי התחלה/סיום לא תקינים' });
  }
  if (ends <= starts) return res.status(400).json({ error: 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה' });

  let planId = null;
  if (b.pricing_plan_id != null && b.pricing_plan_id !== '') {
    planId = Number(b.pricing_plan_id);
    if (!(await selectPlanExistsById(planId))) return res.status(400).json({ error: 'מסלול לא נמצא' });
  }

  const insertId = await insertPromotion([
    b.name.trim(),
    dtype,
    dval,
    planId,
    b.is_active === false ? 0 : 1,
    starts,
    ends,
  ]);
  const row = await selectPromotionById(insertId);
  res.status(201).json(row);
}

export async function updatePromotion(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'מזהה לא תקין' });
  const cur = await selectPromotionById(id);
  if (!cur) return res.status(404).json({ error: 'לא נמצא' });

  const b = req.body || {};
  const starts = b.starts_at != null ? new Date(b.starts_at) : new Date(cur.starts_at);
  const ends = b.ends_at != null ? new Date(b.ends_at) : new Date(cur.ends_at);
  if (Number.isNaN(+starts) || Number.isNaN(+ends)) {
    return res.status(400).json({ error: 'תאריכי התחלה/סיום לא תקינים' });
  }
  if (ends <= starts) return res.status(400).json({ error: 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה' });

  const fields = [];
  const vals = [];

  const set = (col, val) => {
    fields.push(`${col} = ?`);
    vals.push(val);
  };

  if (b.name != null) set('name', String(b.name).trim());
  if (b.discount_type != null) set('discount_type', coerceEnum(b.discount_type, PROMOTION_DISCOUNT_TYPES, 'percent'));
  if (b.discount_value != null) {
    const dval = Number(b.discount_value);
    if (!Number.isFinite(dval) || dval < 0) return res.status(400).json({ error: 'ערך הנחה לא תקין' });
    const dtype =
      b.discount_type != null ? coerceEnum(b.discount_type, PROMOTION_DISCOUNT_TYPES, 'percent') : cur.discount_type;
    if (dtype === 'percent' && dval > 100) return res.status(400).json({ error: 'אחוז לא יעלה על 100' });
    set('discount_value', dval);
  }
  if (b.pricing_plan_id !== undefined) {
    if (b.pricing_plan_id === null || b.pricing_plan_id === '') set('pricing_plan_id', null);
    else {
      const pid = Number(b.pricing_plan_id);
      if (!(await selectPlanExistsById(pid))) return res.status(400).json({ error: 'מסלול לא נמצא' });
      set('pricing_plan_id', pid);
    }
  }
  if (b.is_active !== undefined) set('is_active', b.is_active ? 1 : 0);
  if (b.starts_at != null) set('starts_at', starts);
  if (b.ends_at != null) set('ends_at', ends);

  if (fields.length === 0) return res.status(400).json({ error: 'אין שדות לעדכון' });

  vals.push(id);
  await updatePromotionDynamic(fields.join(', '), vals);

  const row = await selectPromotionJoinedById(id);
  res.json(row);
}

export async function deletePromotion(req, res) {
  const id = Number(req.params.id);
  const affected = await deletePromotionById(id);
  if (affected === 0) return res.status(404).json({ error: 'לא נמצא' });
  res.status(204).send();
}
