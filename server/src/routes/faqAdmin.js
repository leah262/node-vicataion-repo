import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import * as faqAdminController from '../controllers/faqAdminController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/items', asyncHandler(faqAdminController.listItems));
router.post('/items', asyncHandler(faqAdminController.createItem));
router.put('/items/:id', asyncHandler(faqAdminController.updateItem));
router.delete('/items/:id', asyncHandler(faqAdminController.deleteItem));

export default router;
