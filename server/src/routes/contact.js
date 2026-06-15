import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middlewares/auth.js';
import * as contactController from '../controllers/contactController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/', optionalAuth, asyncHandler(contactController.postContact));
router.get('/mine', requireAuth, asyncHandler(contactController.getMyContactMessages));

export default router;
