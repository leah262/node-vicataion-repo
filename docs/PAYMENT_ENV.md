# בדיקת משתני סביבה לתשלום (PayPal / PayMe)

התשלום על פרסום דירה עובד **רק** דרך **PayPal** או **PayMe**. אין מסלול “אישור מיידי” לפיתוח.

## לקוח (`client/.env`)

| משתנה | למה |
|--------|-----|
| `VITE_PAYPAL_CLIENT_ID` | Client ID מ־Sandbox (או Live) — מופיע ב־UI וטוען את SDK של PayPal. חייב להיות **אותו** Client ID כמו בשרת (אותה אפליקציה). |
| `VITE_USE_MOCK` | רק `true` מפעיל דמו מקומי; בלי זה — נתונים מהשרת. |
| `VITE_API_BASE` | אופציונלי. ברירת מחדל: `/api` (פרוקסי של Vite ל־`localhost:5000`). אם מצביעים לשרת מרוחק — שם חייבים להיות מוגדרים גם PayPal ו־PayMe. |

## שרת (`server/.env`)

### PayPal (יצירת הזמנה בשרת)

| משתנה | למה |
|--------|-----|
| `PAYPAL_CLIENT_ID` | כמו ב־`VITE_PAYPAL_CLIENT_ID` (אותו ערך מאותה אפליקציה). |
| `PAYPAL_CLIENT_SECRET` | **Secret** מאותה אפליקציה ב־PayPal Developer — רק בשרת, לא בלקוח. |
| `PAYPAL_API_BASE` | אופציונלי. ריק = Sandbox `https://api-m.sandbox.paypal.com`. Live: `https://api-m.paypal.com`. |
| `PAYPAL_TLS_INSECURE` | אופציונלי. `false` / `off` — כופה אימות TLS מלא. `true` — עוקף אימות (גם ב־`NODE_ENV=production` מקומי, לא בענן). **בלי ערך:** מחוץ לענן ו־`NODE_ENV` לא `production` — השרת **בברירת מחדל** עוקף TLS ל־PayPal (נוח ל־Windows + אנטי־וירוס). בענן (Railway וכו׳) או `NODE_ENV=production` בלי `true` מפורש — לא עוקפים. |

### PayMe

| משתנה | למה |
|--------|-----|
| `PAYME_BASE_URL` | כתובת בסיס של API PayMe (ללא `/` בסוף). |
| `PAYME_MERCHANT_ID` | מזהה סוחר. |
| `PAYME_API_KEY` / `PAYME_SECRET` | לפי תיעוד PayMe שלכם. |
| `PAYME_WEBHOOK_SECRET` | לאימות webhooks (אופציונלי לפי שימוש). |

פרטים נוספים: `docs/PAYME_INTEGRATION.md`.

### כללי

| משתנה | למה |
|--------|-----|
| `APP_URL` | כתובת האתר (למשל `http://localhost:3000`) — קישורים במיילים ולעיתים לזרימות חזרה. |

## אימות מהיר

1. **שרת רץ** — `GET http://localhost:5000/api/health`  
   - `paypal.configured` — האם מוגדרים ID + Secret בשרת.  
   - `payme` — סטטוס שדות PayMe (אם מוגדר בקוד).  
2. **PayPal** — אותו Client ID ב־`client/.env` וב־`server/.env`; אחרי שינוי `.env` — **הפעלה מחדש** של Vite ושל Node.

### קודי שגיאה ל־`POST /api/orders` (PayPal בלבד)

| קוד | משמעות |
|-----|--------|
| **503** | השרת לא רואה `PAYPAL_CLIENT_ID` או `PAYPAL_CLIENT_SECRET` (`server/.env`, restart ל־Node, או `server/.env.local` שדורס). |
| **502** | חיבור/תשובה מ־PayPal — ב־Response שדה `error` (למשל `fetch failed` / TLS, או דחיית Client ID/Secret). |
| **400** | גוף הבקשה: מטבע לא נתמך או סכום לא חוקי. |
