import { FAQ_SECTIONS, coerceEnum } from '../constants/enums.js';
import {
  deleteFaqItem,
  faqItemExistsId,
  insertFaqItem,
  selectAllFaqItemsAdmin,
  selectFaqItemById,
  updateFaqItem,
} from '../models/faqModel.js';
import { HttpError } from '../utils/HttpError.js';

function mapNoTable(e, message) {
  if (e.code === 'ER_NO_SUCH_TABLE') {
    throw new HttpError(503, message);
  }
  throw e;
}

export async function listItems(_req, res) {
  try {
    const rows = await selectAllFaqItemsAdmin();
    res.json(rows);
  } catch (e) {
    mapNoTable(e, 'הריצו npm run setup-faq על מסד הנתונים');
  }
}

export async function createItem(req, res) {
  const b = req.body || {};
  const section = coerceEnum(b.section, FAQ_SECTIONS, 'renters');
  const question = String(b.question || '').trim();
  const answer = String(b.answer || '').trim();
  if (!question) return res.status(400).json({ error: 'שאלה היא שדה חובה' });
  if (!answer) return res.status(400).json({ error: 'תשובה היא שדה חובה' });
  const sortOrder = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0;

  try {
    const insertId = await insertFaqItem(section, question, answer, sortOrder);
    const row = await selectFaqItemById(insertId);
    res.status(201).json(row);
  } catch (e) {
    mapNoTable(e, 'הריצו npm run setup-faq על מסד הנתונים');
  }
}

export async function updateItem(req, res) {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: 'מזהה לא תקין' });

  const b = req.body || {};
  if (!(await faqItemExistsId(id))) return res.status(404).json({ error: 'לא נמצא' });

  const section = coerceEnum(b.section, FAQ_SECTIONS, 'renters');
  const question = String(b.question ?? '').trim();
  const answer = String(b.answer ?? '').trim();
  const sortOrder = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0;

  if (!question) return res.status(400).json({ error: 'שאלה היא שדה חובה' });
  if (!answer) return res.status(400).json({ error: 'תשובה היא שדה חובה' });

  await updateFaqItem(id, section, question, answer, sortOrder);

  const row = await selectFaqItemById(id);
  res.json(row);
}

export async function deleteItem(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'מזהה לא תקין' });

  const affected = await deleteFaqItem(id);
  if (affected === 0) return res.status(404).json({ error: 'לא נמצא' });
  res.status(204).end();
}
