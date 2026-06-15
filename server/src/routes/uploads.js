import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { uploadsDir, postImages } from '../controllers/uploadsController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/', requireAuth, asyncHandler(postImages));

export default router;
export { uploadsDir };
