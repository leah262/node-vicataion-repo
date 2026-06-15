import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import * as contentController from '../controllers/contentController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(contentController.getAllOverrides));
router.put('/:key', requireAuth, requireRole('admin'), asyncHandler(contentController.putOverride));
router.delete('/:key', requireAuth, requireRole('admin'), asyncHandler(contentController.deleteOverride));

export default router;
