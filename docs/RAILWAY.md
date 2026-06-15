# פריסה ל-Railway (שרת בלבד)

## 1. Root Directory

בריפו הזה `package.json` נמצא בתוך **`server/`**. ב-Railway:

**Settings → Service → Root Directory = `server`**

בלי זה, הבילד לא ימצא את הפרויקט Node.

## 2. Start command

ברירת המחדל אחרי Root Directory: **`npm start`** → מריץ `node src/index.js`.

Railway מזריק **`PORT`** אוטומטית — השרת כבר משתמש ב־`process.env.PORT`.

## 3. Build command

אין שלב קומפילציה (JavaScript ישיר). אם ב-Railway מוגדר Build Command מותאם אישית, השאירי ריק או `echo ok` — לא צריך `npm run build`.

## 4. משתני סביבה חובה (לפחות)

| משתנה | למה |
|--------|-----|
| `NODE_ENV` | `production` |
| `DATABASE_URL` או משתני MySQL | חיבור למסד (למשל משירות MySQL של Railway) |
| `JWT_SECRET` | אימות JWT |
| `CORS_ORIGINS` | **חובה בפרודקשן** — כתובת/ות הפרונטאנד המלאות (מופרדות בפסיק), למשל `https://your-app.vercel.app` |
| `PUBLIC_API_URL` | מומלץ: `https://<שם-השירות>.up.railway.app/api` (או דומיין מותאם) — קישורי מייל ו־API ציבורי |
| `APP_URL` | כתובת האתר הציבורי (SPA) לקישורי מייל; אם אין SPA עדיין, אפשר להשאיר ריק (הקישורים ישתמשו בבסיס השרת לפי `publicUrls.js`) |
| Cloudinary | `CLOUDINARY_URL` או שלישיית `CLOUDINARY_*` — בלי זה **העלאת תמונות תחזיר 503** |

השלימי לפי `server/.env.example` (SMTP, PayPal/PayMe וכו׳).

## 5. מסד נתונים

אחרי שהשירות עולה, צריך סכימה ב-MySQL. מקומית/בדפדפן SSH אפשר להריץ מתוך `server/`:

`npm run setup-db`, `npm run migrate`, וכו׳ — ראו `package.json` scripts.

## 6. האם “זה יעבוד” מיד אחרי Push?

- **כן**, אם: Root Directory = `server`, משתני סביבה מלאים, MySQL זמין, `CORS_ORIGINS` תואם לדומיין הפרונטאנד, ו-Cloudinary מוגדר אם משתמשים בהעלאות.
- **לא**, אם: נשאר `start` שמצביע ל־`dist/app.js` בלי build (תוקן בקומיט הזה), או `CORS_ORIGINS` ריק בפרודקשן (דפדפן יחסום קריאות cross-origin), או DB/סודות חסרים.

בדיקה מהירה אחרי פריסה: `GET https://<your-host>/api/health`.
