import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { paymeCreateLimiter } from '../middlewares/rateLimit.js';
import { validatePayMeCreateBody } from '../middlewares/validatePayMeCreate.js';
import { createPayMePayment, getPayMePaymentStatus } from '../controllers/paymentController.js';
import * as listingPayments from '../controllers/listingPaymentsController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post(
  '/create',
  requireAuth,
  paymeCreateLimiter,
  validatePayMeCreateBody,
  asyncHandler(createPayMePayment),
);

router.post('/', requireAuth, asyncHandler(listingPayments.createListingPayment));
router.get('/mine', requireAuth, asyncHandler(listingPayments.listMineListingPayments));
router.get('/', requireAuth, requireRole('admin'), asyncHandler(listingPayments.listAllListingPaymentsAdmin));
router.get('/fee', listingPayments.getListingFee);

/** Skip non-numeric `:id` so `/mine` etc. are not captured as `/:id/status` (Express 5 path-to-regexp). */
function skipUnlessNumericPaymentId(req, res, next) {
  const id = String(req.params.id || '');
  if (!/^\d+$/.test(id) || Number(id) <= 0) {
    return next('route');
  }
  next();
}

router.get('/:id/status', requireAuth, skipUnlessNumericPaymentId, asyncHandler(getPayMePaymentStatus));

export default router;
