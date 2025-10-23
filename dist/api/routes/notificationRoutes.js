"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const notificationController_1 = require("../controllers/notificationController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
/**
 * @route   POST /api/notifications/register-token
 * @desc    Register or update user's FCM token
 * @access  Private
 */
router.post('/register-token', authMiddleware_1.protect, notificationController_1.registerFCMToken);
/**
 * @route   POST /api/notifications/remove-token
 * @desc    Remove user's FCM token (for logout)
 * @access  Private
 */
router.post('/remove-token', authMiddleware_1.protect, notificationController_1.removeFCMToken);
/**
 * @route   POST /api/notifications/test
 * @desc    Send test notification to authenticated user
 * @access  Private
 */
router.post('/test', authMiddleware_1.protect, notificationController_1.sendTestNotification);
/**
 * @route   POST /api/notifications/send
 * @desc    Send notification to a specific user
 * @access  Private (Admin only)
 */
router.post('/send', authMiddleware_1.protect, authMiddleware_1.adminOnly, notificationController_1.sendNotification);
/**
 * @route   POST /api/notifications/send-bulk
 * @desc    Send notification to multiple users
 * @access  Private (Admin only)
 */
router.post('/send-bulk', authMiddleware_1.protect, authMiddleware_1.adminOnly, notificationController_1.sendBulkNotification);
/**
 * @route   POST /api/notifications/send-to-type
 * @desc    Send notification to all users of a type (rider or driver)
 * @access  Private (Admin only)
 */
router.post('/send-to-type', authMiddleware_1.protect, authMiddleware_1.adminOnly, notificationController_1.sendToUserType);
/**
 * @route   POST /api/notifications/send-to-nearby-drivers
 * @desc    Send notification to nearby drivers
 * @access  Private
 */
router.post('/send-to-nearby-drivers', authMiddleware_1.protect, notificationController_1.sendToNearbyDrivers);
exports.default = router;
