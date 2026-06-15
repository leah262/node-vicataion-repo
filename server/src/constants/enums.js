// ערכים מותרים לשדות "סוג" במסד הנתונים.
// במקום ENUM ברמת ה-DB, הערכים נשמרים כ-VARCHAR ונאכפים כאן ברמת האפליקציה.
// כך קל להרחיב ערכים ללא ALTER TABLE, והוולידציה ריכוזית ועקבית.

export const USER_ROLES = ['owner', 'admin'];

export const APARTMENT_STATUSES = ['pending', 'approved', 'rejected', 'expired'];

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

export const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled'];

export const PRICING_CATEGORIES = ['hosts', 'hotels'];

export const PRICING_HIGHLIGHTS = ['none', 'popular', 'premium'];

export const PROMOTION_DISCOUNT_TYPES = ['percent', 'flat'];

export const FAQ_SECTIONS = ['renters', 'hosts'];

// מחזיר ערך חוקי מתוך רשימת ערכים מותרת, אחרת ערך ברירת המחדל.
export function coerceEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

// בודק אם ערך נמצא ברשימת הערכים המותרת.
export function isValidEnum(value, allowed) {
  return allowed.includes(value);
}
