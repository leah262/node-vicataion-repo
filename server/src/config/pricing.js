// תמחור פרסום נכס — מקור אמת בצד השרת (אכיפה).
// tier 'standard' — דירות/יחידות אירוח/צימרים.
// tier 'premium'  — סוג נכס "מתחמי אירוח".

export const COMPLEX_PROPERTY_TYPE = 'מתחמי אירוח';

const STANDARD_TABLE = { 1: 30, 2: 60, 12: 330 };
const PREMIUM_TABLE = { 1: 80, 12: 550 };

const STANDARD_PER_MONTH = 30;
const PREMIUM_PER_MONTH = 80;

// מחשב את הסכום הכולל לפי tier ומספר חודשים.
export function getPlanAmount(tier, months) {
  const monthsInt = Math.max(1, Number(months) || 1);
  const table = tier === 'premium' ? PREMIUM_TABLE : STANDARD_TABLE;
  if (table[monthsInt]) return table[monthsInt];
  const perMonth = tier === 'premium' ? PREMIUM_PER_MONTH : STANDARD_PER_MONTH;
  return perMonth * monthsInt;
}

// קובע אם נכס מחויב בתעריף פרימיום — לפי סוג הנכס "מתחמי אירוח".
export function isPremiumApartment(apartment) {
  return apartment?.property_type === COMPLEX_PROPERTY_TYPE;
}
