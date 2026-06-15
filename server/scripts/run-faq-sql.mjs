// יוצר טבלת faq_items ומזרים נתוני התחלה אם הטבלה ריקה.
// מריץ מתוך server/:  npm run setup-faq

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..');
const dbDir = path.join(serverRoot, '../db');

const envLocalPath = path.join(serverRoot, '.env.local');
dotenv.config({ path: path.join(serverRoot, '.env') });
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

function getSslConfig() {
  const sslMode = (process.env.DB_SSL_MODE || '').toUpperCase();
  if (['OFF', 'DISABLED', 'FALSE', ''].includes(sslMode)) return undefined;
  const caPath = path.join(dbDir, 'ca.pem');
  if (fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath), rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

function sanitize(sql) {
  return sql
    .split('\n')
    .filter((line) => {
      const t = line.trim().toUpperCase();
      return !t.startsWith('USE ') && !t.startsWith('CREATE DATABASE');
    })
    .join('\n');
}

/** תוכן התחלתי — תואם ל־FaqPage לפני העברה ל־DB */
const SEED_ROWS = [
  {
    section: 'renters',
    sort_order: 0,
    question: 'האם השימוש באתר הוא חינמי?',
    answer:
      'בהחלט. הגלישה באתר, החיפוש ומציאת דירות הנופש הם חינמיים לחלוטין ופתוחים לכולם. אין צורך בתשלום או בהרשמה – פשוט נכנסים, מוצאים את הדירה המתאימה, ויוצרים קשר ישיר עם בעל הנכס.',
  },
  {
    section: 'renters',
    sort_order: 1,
    question: 'האם ניתן להזמין ולשלם על הדירה ישירות דרך האתר?',
    answer:
      'לא. האתר משמש כלוח פרסום דיגיטלי ומקשר ביניכם לבין בעלי הדירות. סגירת העסקה, סיכומי המחיר, תנאי האירוח והתשלום עצמו מתבצעים ישירות מול בעל הנכס בטלפון או באמצעות כפתור "שליחת הודעה" שבעמוד המודעה.',
  },
  {
    section: 'renters',
    sort_order: 2,
    question: 'לפי מה נקבע המחיר המופיע במודעה?',
    answer:
      'המחיר המצוין באתר הוא בדרך כלל מחיר בסיס (מינימום) לאירוח זוגי בסוף שבוע רגיל (שבת). תעריפי האירוח עשויים להשתנות בהתאם לכמות האורחים, עונות השנה, חגים, ותנאים מיוחדים. אנו ממליצים לוודא את המחיר הסופי ישירות מול בעל הדירה בעת הפנייה.',
  },
  {
    section: 'renters',
    sort_order: 3,
    question: 'האם האתר בודק את אמינות הדירות או נותן אחריות עליהן?',
    answer:
      'האתר פועל כפלטפורמה מתווכת בלבד. התכנים, התיאורים והתמונות מועלים באחריותם הבלעדית של בעלי הנכסים. הנהלת האתר אינה מבצעת בדיקות פיזיות של הנכסים ואינה נושאת באחריות על טיב האירוח או על חילוקי דעות בין הצדדים. אנו ממליצים לשוכרים להפעיל שיקול דעת ולבדוק את כל הפרטים הרלוונטיים טרם סגירת העסקה.',
  },
  {
    section: 'hosts',
    sort_order: 0,
    question: 'מדוע כדאי לי לפרסם את דירת הנופש שלי דווקא כאן?',
    answer:
      'חבל להשאיר כסף על השולחן! הפלטפורמה שלנו נולדה כדי לעזור לכם לייצר הכנסה נוספת ויציבה מהנכס שלכם, במינימום זמן ומאמץ ובמקסימום רווח. אתם לא צריכים להוסיף שעות עבודה או לשנות את שגרת החיים – המערכת שלנו מנגישה את הדירה שלכם ישירות לקהל יעד ענק וממוקד של משפחות שמחפשות פתרונות אירוח ונופש, ומאפשרת לכם להתחיל להרוויח בראש שקט לגמרי.',
  },
  {
    section: 'hosts',
    sort_order: 1,
    question: 'האם פרסום דירה באתר כרוך בתשלום?',
    answer:
      'האתר מציע מספר מסלולי פרסום ומנויים אטרקטיביים ומשתלמים (חודשי, דו-חודשי או שנתי), המאפשרים לכם לקבל חשיפה מקסימלית לנכס שלכם. את פירוט המסלולים והעלויות העדכניות ניתן לראות בעמוד "הוספת נכס" או באזור האישי לאחר ההרשמה.',
  },
  {
    section: 'hosts',
    sort_order: 2,
    question: 'פרסמתי דירה או עדכנתי פרטים, מדוע אני לא רואה את המודעה מיד?',
    answer:
      'כדי לשמור על רמת אמינות גבוהה ואיכות התוכן באתר, כל מודעה חדשה או עדכון מהותי עוברים אישור ידני על ידי צוות הנהלת האתר. המודעות מאושרות ועולות לאוויר בדרך כלל בתוך שעות ספורות מרגע הזנתן.',
  },
  {
    section: 'hosts',
    sort_order: 3,
    question: 'האם ניתן להקפיא את המנוי או לקבל החזר במידה והשכרתי את הדירה?',
    answer:
      'המנויים באתר נרכשים לתקופת זמן קצובה מראש, והעסקאות הינן סופיות ללא אפשרות להחזר כספי או הקפאה (כמפורט בתקנון האתר). יחד עם זאת, המערכת מעניקה לכם גמישות מלאה – בכל שלב במהלך תקופת המנוי תוכלו להיכנס לאזור האישי, לערוך את פרטי המודעה, לשנות תמונות, לעדכן תאריכי זמינות או להפוך את המודעה ל"לא זמינה זמנית" ולפתוח אותה מחדש כשתרצו.',
  },
  {
    section: 'hosts',
    sort_order: 4,
    question: 'למה האתר צריך את כתובת המייל שלי ואיך מתחברים?',
    answer:
      'כתובת הדואר האלקטרוני נדרשת לצורך אימות זהותכם, יצירת האזור האישי המאובטח שלכם (שם תוכלו לנהל את המודעות), וקבלת הודעות תפעוליות חשובות משוכרים פוטנציאליים. ניתן להירשם בקלות באמצעות המייל או בחיבור מהיר בלחיצה אחת דרך חשבון Google.',
  },
];

async function run() {
  const ddlPath = path.join(dbDir, 'faq_tables.sql');
  if (!fs.existsSync(ddlPath)) {
    console.error('Missing:', ddlPath);
    process.exit(1);
  }

  console.log(`Connecting to ${process.env.DB_HOST}:${process.env.DB_PORT} / ${process.env.DB_NAME} ...`);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: getSslConfig(),
    multipleStatements: true,
    connectTimeout: 20000,
  });

  try {
    console.log('Running faq_tables.sql ...');
    await conn.query(sanitize(fs.readFileSync(ddlPath, 'utf8')));
    console.log('  ✓ faq_items');

    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM faq_items');
    if (Number(n) === 0) {
      console.log('Seeding default FAQ rows ...');
      for (const row of SEED_ROWS) {
        await conn.query(
          `INSERT INTO faq_items (section, question, answer, sort_order) VALUES (?, ?, ?, ?)`,
          [row.section, row.question, row.answer, row.sort_order],
        );
      }
      console.log(`  ✓ inserted ${SEED_ROWS.length} items`);
    } else {
      console.log(`  (skip seed: faq_items already has ${n} rows)`);
    }

    const [[{ total }]] = await conn.query('SELECT COUNT(*) AS total FROM faq_items');
    console.log(`\nfaq_items rows: ${total}\nDone.`);
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
