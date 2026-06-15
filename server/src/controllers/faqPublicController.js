import { selectFaqCatalogRows } from '../models/faqModel.js';
import { HttpError } from '../utils/HttpError.js';

const SECTION_ORDER = ['renters', 'hosts'];

const SECTION_META = {
  renters: {
    id: 'renters',
    icon: '🏠',
    title: 'שאלות נפוצות – למחפשי דירות (שוכרים)',
  },
  hosts: {
    id: 'hosts',
    icon: '🔑',
    title: 'שאלות נפוצות – למפרסמי דירות (מארחים)',
  },
};

export async function getFaqCatalog(_req, res) {
  try {
    const rows = await selectFaqCatalogRows();

    const sections = SECTION_ORDER.map((key) => ({
      ...SECTION_META[key],
      items: rows
        .filter((r) => r.section === key)
        .map((r) => ({
          id: r.id,
          question: r.question,
          answer: r.answer,
        })),
    }));

    res.json({ sections });
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      throw new HttpError(503, 'הריצו npm run setup-faq (או db/faq_tables.sql) על מסד הנתונים');
    }
    throw e;
  }
}
