import { Router } from 'express';
import * as paypalOrdersController from '../controllers/paypalOrdersController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/', asyncHandler(paypalOrdersController.createOrder));
router.post('/:orderID/capture', asyncHandler(paypalOrdersController.captureOrder));

export default router;
