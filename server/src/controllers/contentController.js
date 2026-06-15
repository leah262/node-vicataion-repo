import {
  deleteSiteContentByKey,
  ensureSiteContentTable,
  selectAllSiteContent,
  upsertSiteContent,
} from '../models/siteContentModel.js';

function sanitizeKey(raw) {
  const key = String(raw || '').trim();
  if (!key || key.length > 191 || !/^[a-zA-Z0-9._:-]+$/.test(key)) return null;
  return key;
}

function sanitizeFontSize(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = String(raw).trim();
  if (/^\d{1,3}(\.\d+)?(px|rem|em)?$/.test(value)) {
    return /^\d/.test(value) && !/(px|rem|em)$/.test(value) ? `${value}px` : value;
  }
  return null;
}

function sanitizeColor(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = String(raw).trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) return value;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/.test(value)) {
    return value;
  }
  return null;
}

export async function getAllOverrides(_req, res) {
  try {
    await ensureSiteContentTable();
    const rows = await selectAllSiteContent();
    const map = {};
    for (const row of rows) {
      map[row.content_key] = {
        text: row.body,
        fontSize: row.font_size || null,
        color: row.color || null,
      };
    }
    res.json(map);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return res.json({});
    console.error('[content] load error:', error.message);
    res.json({});
  }
}

export async function putOverride(req, res) {
  await ensureSiteContentTable();
  const key = sanitizeKey(req.params.key);
  if (!key) return res.status(400).json({ error: 'מפתח תוכן לא תקין' });

  const body = req.body || {};
  const text = body.text === null || body.text === undefined ? null : String(body.text);
  const fontSize = sanitizeFontSize(body.fontSize);
  const color = sanitizeColor(body.color);

  await upsertSiteContent(key, text, fontSize, color);

  res.json({ key, text, fontSize, color });
}

export async function deleteOverride(req, res) {
  await ensureSiteContentTable();
  const key = sanitizeKey(req.params.key);
  if (!key) return res.status(400).json({ error: 'מפתח תוכן לא תקין' });
  await deleteSiteContentByKey(key);
  res.status(204).end();
}
