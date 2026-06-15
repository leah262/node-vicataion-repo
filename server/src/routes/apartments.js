import { Router } from 'express';
import {
  requireAuth,
  requireRole,
  optionalAuth,
} from '../middlewares/auth.js';
import * as apartments from '../controllers/apartmentsController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', optionalAuth, asyncHandler(apartments.listPublic));
router.get('/mine', requireAuth, asyncHandler(apartments.listMine));
router.get('/pending', requireAuth, requireRole('admin'), asyncHandler(apartments.listPending));
router.get('/:id', optionalAuth, asyncHandler(apartments.getById));
router.post('/:id/inquiry', asyncHandler(apartments.postInquiry));
router.post('/', requireAuth, asyncHandler(apartments.create));
router.put('/:id', requireAuth, asyncHandler(apartments.update));
router.delete('/:id', requireAuth, asyncHandler(apartments.remove));
router.post('/:id/approve', requireAuth, requireRole('admin'), asyncHandler(apartments.approve));
router.get('/:id/email-approve', asyncHandler(apartments.emailApprove));
router.post('/:id/reject', requireAuth, requireRole('admin'), asyncHandler(apartments.reject));

export default router;
