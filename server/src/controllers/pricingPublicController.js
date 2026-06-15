import { selectActivePlansCatalog, selectActivePromotionsNow } from '../models/pricingModel.js';
import { bestDiscountedPrice, formatIls, resolveDisplayOriginal } from '../services/pricingCompute.js';
import { HttpError } from '../utils/HttpError.js';

function parseFeatures(row) {
  try {
    const j = row.features_json;
    if (Array.isArray(j)) return j.map(String);
    if (typeof j === 'string') return JSON.parse(j);
    return [];
  } catch {
    return [];
  }
}

export async function getCatalog(_req, res) {
  try {
    const plans = await selectActivePlansCatalog();
    const promos = await selectActivePromotionsNow();

    const groups = {};
    for (const row of plans) {
      const cat = row.category;
      if (!groups[cat]) groups[cat] = [];
      const applicable = promos.filter(
        (p) => p.pricing_plan_id == null || Number(p.pricing_plan_id) === Number(row.id),
      );
      const { effective, promotion } = bestDiscountedPrice(row.price, applicable);
      const base = Number(row.price);
      const original = resolveDisplayOriginal({
        basePrice: base,
        effectivePrice: effective,
        compareAtPrice: row.compare_at_price,
      });

      const hasPromo = effective < base - 1e-9;
      const cmp = row.compare_at_price != null ? Number(row.compare_at_price) : null;
      const hasCompareStrike =
        cmp != null && Number.isFinite(cmp) && cmp > effective + 1e-9 && !hasPromo;

      groups[cat].push({
        id: row.id,
        slug: row.slug,
        category: row.category,
        name: row.name,
        description: row.description,
        basePrice: base,
        effectivePrice: effective,
        currency: row.currency || 'ILS',
        basePriceFormatted: formatIls(base),
        effectivePriceFormatted: formatIls(effective),
        originalPriceFormatted: original != null ? formatIls(original) : null,
        hasDiscount: hasPromo || hasCompareStrike,
        durationMonths: row.duration_months,
        durationLabel: row.duration_label,
        features: parseFeatures(row),
        highlightType: row.highlight_type,
        badgeText: row.badge_text,
        promotion: promotion
          ? {
              id: promotion.id,
              name: promotion.name,
              discountType: promotion.discount_type,
              discountValue: Number(promotion.discount_value),
            }
          : null,
      });
    }

    res.json({
      groups: [
        { category: 'hosts', plans: groups.hosts || [] },
        { category: 'hotels', plans: groups.hotels || [] },
      ],
    });
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      throw new HttpError(
        503,
        'טבלאות מחירון עדיין לא הותקנו. הריצו db/pricing_tables.sql על מסד הנתונים.',
        'PRICING_SCHEMA_MISSING',
      );
    }
    console.error('[pricing/catalog]', error);
    throw error;
  }
}
