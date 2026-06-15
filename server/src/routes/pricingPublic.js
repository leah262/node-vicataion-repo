import { Router } from 'express';
import * as pricingPublicController from '../controllers/pricingPublicController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/catalog', asyncHandler(pricingPublicController.getCatalog));

export default router;
