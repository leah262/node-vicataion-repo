import multer from 'multer';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { cloudinary, ensureCloudinaryConfigured, isCloudinaryConfigured } from '../config/cloudinary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Legacy local folder — only used so `/uploads` static can still serve old files if present. */
export const uploadsDir = path.join(__dirname, '../../uploads');

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) cb(null, true);
    else cb(new Error('סוג קובץ לא נתמך. ניתן להעלות תמונות בלבד (jpg, png, webp, gif).'));
  },
});

function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const folder = (process.env.CLOUDINARY_UPLOAD_FOLDER || 'vacation-rentals').replace(/^\/+|\/+$/g, '');
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) reject(error);
        else if (result?.secure_url) resolve(result.secure_url);
        else reject(new Error('Cloudinary upload failed'));
      },
    );
    Readable.from(buffer).pipe(stream);
  });
}

export function postImages(req, res) {
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({
      error:
        'העלאת תמונות מושבתת: חסרים משתני Cloudinary. הגדירו CLOUDINARY_URL או CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.',
    });
  }
  ensureCloudinaryConfigured();

  upload.array('images', 20)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'לא הועלו קבצים' });
    }
    try {
      const urls = [];
      for (const file of files) {
        const url = await uploadBufferToCloudinary(file.buffer);
        urls.push(url);
      }
      res.json({ urls });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return res.status(500).json({ error: message });
    }
  });
}
