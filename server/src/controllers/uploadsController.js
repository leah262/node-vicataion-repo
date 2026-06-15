import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) cb(null, true);
    else cb(new Error('סוג קובץ לא נתמך. ניתן להעלות תמונות בלבד (jpg, png, webp, gif).'));
  },
});

export function postImages(req, res) {
  upload.array('images', 20)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    const base = `${req.protocol}://${req.get('host')}`;
    const urls = (req.files || []).map((f) => `${base}/uploads/${f.filename}`);
    res.json({ urls });
  });
}
