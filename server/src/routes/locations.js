import { Router } from 'express';
import * as locationsController from '../controllers/locationsController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/regions', asyncHandler(locationsController.getRegions));

export default router;
