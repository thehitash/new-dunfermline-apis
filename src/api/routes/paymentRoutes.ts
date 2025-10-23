import express from 'express';
import {
  initiatePayment,
  verifyPayment,
  handleRevolutWebhook,
  cancelPayment,
  getPaymentDetails
} from '../controllers/paymentController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

// Protected routes (require authentication)
router.post('/initiate', protect, initiatePayment);
router.get('/verify/:paymentId', protect, verifyPayment);
router.post('/cancel/:paymentId', protect, cancelPayment);
router.get('/:paymentId', protect, getPaymentDetails);

// Webhook route (no auth required - Revolut will call this)
router.post('/webhook/revolut', handleRevolutWebhook);

export default router;
