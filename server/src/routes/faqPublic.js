import { Router } from 'express';
import * as faqPublicController from '../controllers/faqPublicController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(faqPublicController.getFaqCatalog));

export default router;
