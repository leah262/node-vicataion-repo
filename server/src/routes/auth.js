import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { authLimiter, sensitiveLimiter } from '../middlewares/rateLimit.js';
import * as authController from '../controllers/authController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/register', authLimiter, asyncHandler(authController.register));
router.get('/verify-email', asyncHandler(authController.verifyEmail));
router.post('/resend-verification', sensitiveLimiter, asyncHandler(authController.resendVerification));
router.post('/forgot-password', sensitiveLimiter, asyncHandler(authController.forgotPassword));
router.post('/reset-password', sensitiveLimiter, asyncHandler(authController.resetPassword));
router.post('/login', authLimiter, asyncHandler(authController.login));
router.post('/google', authLimiter, asyncHandler(authController.googleAuth));
router.get('/me', requireAuth, asyncHandler(authController.me));
router.get('/users', requireAuth, requireRole('admin'), asyncHandler(authController.listUsers));

export default router;
