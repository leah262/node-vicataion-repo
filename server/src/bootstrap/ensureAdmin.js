import bcrypt from 'bcryptjs';
import { adminExistsByEmail, insertAdminUser } from '../models/userModel.js';

export async function ensureAdminUser() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn('[Auth] ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin bootstrap');
    return;
  }

  if (await adminExistsByEmail(email)) {
    return;
  }

  const password_hash = await bcrypt.hash(password, 12);
  await insertAdminUser({ full_name: 'מנהל המערכת', email, password_hash });

  console.log(`[Auth] Admin user created: ${email}`);
}
