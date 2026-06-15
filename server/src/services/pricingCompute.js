/**
 * מחיר אפקטיבי אחרי מבצע — בוחר את ההנחה הכי משתלמת (מחיר סופי הנמוך ביותר).
 * @param {number} basePrice
 * @param {Array<{ discount_type: string, discount_value: number }>} promos
 */
export function bestDiscountedPrice(basePrice, promos) {
  const base = Number(basePrice);
  if (!Number.isFinite(base) || base < 0) return { effective: 0, promotion: null };

  let best = base;
  let bestPromo = null;

  for (const p of promos || []) {
    const v = Number(p.discount_value);
    if (!Number.isFinite(v) || v < 0) continue;

    let candidate = base;
    if (p.discount_type === 'percent') {
      const pct = Math.min(100, Math.max(0, v));
      candidate = base * (1 - pct / 100);
    } else {
      candidate = Math.max(0, base - v);
    }

    if (candidate < best - 1e-9) {
      best = candidate;
      bestPromo = p;
    }
  }

  return { effective: Math.round(best * 100) / 100, promotion: bestPromo };
}

export function formatIls(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₪0.00';
  return `₪${n.toFixed(2)}`;
}

/**
 * מחיר מקור לתצוגה עם קו חוצה: מחיר בסיס אם יש מבצע, או compare_at אם גבוה מהאפקטיבי
 */
export function resolveDisplayOriginal({ basePrice, effectivePrice, compareAtPrice }) {
  const base = Number(basePrice);
  const eff = Number(effectivePrice);
  const cmp = compareAtPrice != null ? Number(compareAtPrice) : null;

  if (eff < base - 1e-9) return base;
  if (cmp != null && Number.isFinite(cmp) && cmp > eff + 1e-9) return cmp;
  return null;
}
