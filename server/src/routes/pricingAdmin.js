import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import * as pricingAdmin from '../controllers/pricingAdminController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/plans', asyncHandler(pricingAdmin.listPlans));
router.post('/plans', asyncHandler(pricingAdmin.createPlan));
router.put('/plans/:id', asyncHandler(pricingAdmin.updatePlan));
router.delete('/plans/:id', asyncHandler(pricingAdmin.deletePlan));
router.get('/promotions', asyncHandler(pricingAdmin.listPromotions));
router.post('/promotions', asyncHandler(pricingAdmin.createPromotion));
router.put('/promotions/:id', asyncHandler(pricingAdmin.updatePromotion));
router.delete('/promotions/:id', asyncHandler(pricingAdmin.deletePromotion));

export default router;
