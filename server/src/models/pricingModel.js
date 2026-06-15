import pool from '../config/db.js';

export async function selectAllPricingPlansOrdered() {
  const [rows] = await pool.query(
    `SELECT * FROM pricing_plans ORDER BY category ASC, sort_order ASC, id ASC`,
  );
  return rows;
}

export async function insertPricingPlan(params) {
  await pool.query(
    `INSERT INTO pricing_plans
     (slug, category, name, description, price, compare_at_price, currency, duration_months, duration_label,
      features_json, highlight_type, badge_text, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?)`,
    params,
  );
}

export async function selectPlanBySlug(slug) {
  const [rows] = await pool.query('SELECT * FROM pricing_plans WHERE slug = ?', [slug]);
  return rows[0] || null;
}

export async function selectPlanIdExists(id) {
  const [existing] = await pool.query('SELECT id FROM pricing_plans WHERE id = ?', [id]);
  return existing.length > 0;
}

export async function selectPlanSlugDuplicate(slug, excludeId) {
  const [dup] = await pool.query('SELECT id FROM pricing_plans WHERE slug = ? AND id <> ?', [
    slug,
    excludeId,
  ]);
  return dup.length > 0;
}

export async function updatePricingPlanDynamic(sql, values) {
  await pool.query(`UPDATE pricing_plans SET ${sql} WHERE id = ?`, values);
}

export async function selectPlanById(id) {
  const [rows] = await pool.query('SELECT * FROM pricing_plans WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function deletePricingPlan(id) {
  const [r] = await pool.query('DELETE FROM pricing_plans WHERE id = ?', [id]);
  return r.affectedRows || 0;
}

export async function selectPromotionsWithPlanName() {
  const [rows] = await pool.query(
    `SELECT p.*, pl.name AS plan_name
     FROM pricing_promotions p
     LEFT JOIN pricing_plans pl ON pl.id = p.pricing_plan_id
     ORDER BY p.starts_at DESC, p.id DESC`,
  );
  return rows;
}

export async function selectPlanExistsById(planId) {
  const [pl] = await pool.query('SELECT id FROM pricing_plans WHERE id = ?', [planId]);
  return pl.length > 0;
}

export async function insertPromotion(params) {
  const [result] = await pool.query(
    `INSERT INTO pricing_promotions
     (name, discount_type, discount_value, pricing_plan_id, is_active, starts_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    params,
  );
  return result.insertId;
}

export async function selectPromotionById(id) {
  const [rows] = await pool.query('SELECT * FROM pricing_promotions WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function updatePromotionDynamic(sql, values) {
  await pool.query(`UPDATE pricing_promotions SET ${sql} WHERE id = ?`, values);
}

export async function selectPromotionJoinedById(id) {
  const [rows] = await pool.query(
    `SELECT p.*, pl.name AS plan_name FROM pricing_promotions p
     LEFT JOIN pricing_plans pl ON pl.id = p.pricing_plan_id WHERE p.id = ?`,
    [id],
  );
  return rows[0] || null;
}

export async function deletePromotionById(id) {
  const [r] = await pool.query('DELETE FROM pricing_promotions WHERE id = ?', [id]);
  return r.affectedRows || 0;
}

export async function selectActivePlansCatalog() {
  const [plans] = await pool.query(
    `SELECT * FROM pricing_plans WHERE is_active = TRUE ORDER BY category ASC, sort_order ASC, id ASC`,
  );
  return plans;
}

export async function selectActivePromotionsNow() {
  const [promos] = await pool.query(
    `SELECT * FROM pricing_promotions
     WHERE is_active = TRUE
       AND starts_at <= NOW()
       AND ends_at >= NOW()`,
  );
  return promos;
}
