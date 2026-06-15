import { v2 as cloudinary } from 'cloudinary';

let applied = false;

export function isCloudinaryConfigured() {
  if (process.env.CLOUDINARY_URL && String(process.env.CLOUDINARY_URL).trim()) {
    return true;
  }
  const n = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const k = process.env.CLOUDINARY_API_KEY?.trim();
  const s = process.env.CLOUDINARY_API_SECRET?.trim();
  return Boolean(n && k && s);
}

/** Idempotent: call before uploads. */
export function ensureCloudinaryConfigured() {
  if (applied) return isCloudinaryConfigured();
  if (!isCloudinaryConfigured()) return false;
  if (process.env.CLOUDINARY_URL && String(process.env.CLOUDINARY_URL).trim()) {
    cloudinary.config();
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
  applied = true;
  return true;
}

export { cloudinary };
