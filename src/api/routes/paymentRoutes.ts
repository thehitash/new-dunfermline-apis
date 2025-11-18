import express from 'express';
import {
  initiatePayment,
  verifyPayment,
  handleRevolutWebhook,
  cancelPayment,
  getPaymentDetails,
  handlePaymentSuccess,
  handlePaymentFailure,
  handlePaymentCancelled
} from '../controllers/paymentController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

// Protected routes (require authentication)
router.post('/initiate', protect, initiatePayment);
router.get('/verify/:paymentId', protect, verifyPayment);
router.post('/cancel/:paymentId', protect, cancelPayment);
router.get('/:paymentId', protect, getPaymentDetails);

// Webhook and redirect routes (no auth required - Revolut will call these)
router.post('/webhook/revolut', handleRevolutWebhook);
router.get('/success', handlePaymentSuccess);
router.get('/failure', handlePaymentFailure);
router.get('/cancel', handlePaymentCancelled);

export default router;
