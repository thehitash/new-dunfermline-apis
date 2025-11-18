import express from 'express';
import {
  registerFCMToken,
  removeFCMToken,
  sendTestNotification,
  sendNotification,
  sendBulkNotification,
  sendToUserType,
  sendToNearbyDrivers,
  sendPromotionalNotification,
  sendToAllUsers,
} from '../controllers/notificationController';
import { protect, adminOnly } from '../middlewares/authMiddleware';

const router = express.Router();

/**
 * @route   POST /api/notifications/register-token
 * @desc    Register or update user's FCM token
 * @access  Private
 */
router.post('/register-token', protect, registerFCMToken);

/**
 * @route   POST /api/notifications/remove-token
 * @desc    Remove user's FCM token (for logout)
 * @access  Private
 */
router.post('/remove-token', protect, removeFCMToken);

/**
 * @route   POST /api/notifications/test
 * @desc    Send test notification to authenticated user
 * @access  Private
 */
router.post('/test', protect, sendTestNotification);

/**
 * @route   POST /api/notifications/send
 * @desc    Send notification to a specific user
 * @access  Private (Admin only)
 */
router.post('/send', protect, adminOnly, sendNotification);

/**
 * @route   POST /api/notifications/send-bulk
 * @desc    Send notification to multiple users
 * @access  Private (Admin only)
 */
router.post('/send-bulk', protect, adminOnly, sendBulkNotification);

/**
 * @route   POST /api/notifications/send-to-type
 * @desc    Send notification to all users of a type (rider or driver)
 * @access  Private (Admin only)
 */
router.post('/send-to-type', protect, adminOnly, sendToUserType);

/**
 * @route   POST /api/notifications/send-to-nearby-drivers
 * @desc    Send notification to nearby drivers
 * @access  Private
 */
router.post('/send-to-nearby-drivers', protect, adminOnly, sendToNearbyDrivers);

/**
 * @route   POST /api/notifications/promotional
 * @desc    Send promotional notification (e.g., "Book Now - 10% Off!")
 * @access  Private (Admin only)
 */
router.post('/promotional', protect, adminOnly, sendPromotionalNotification);

/**
 * @route   POST /api/notifications/send-to-all
 * @desc    Send notification to all users (riders and drivers)
 * @access  Private (Admin only)
 */
router.post('/send-to-all', protect, adminOnly, sendToAllUsers);

export default router;
