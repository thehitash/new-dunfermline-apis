"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendToNearbyDrivers = exports.sendToUserType = exports.sendBulkNotification = exports.sendNotification = exports.sendTestNotification = exports.removeFCMToken = exports.registerFCMToken = void 0;
const user_1 = __importDefault(require("../models/user"));
const notificationService_1 = __importDefault(require("../../services/notificationService"));
/**
 * Register or update user's FCM token
 */
const registerFCMToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { fcmToken } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id; // From auth middleware
        if (!fcmToken) {
            return res.status(400).json({
                status: false,
                message: 'FCM token is required',
            });
        }
        if (!userId) {
            return res.status(401).json({
                status: false,
                message: 'User not authenticated',
            });
        }
        // Find user
        const user = yield user_1.default.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found',
            });
        }
        // Update user's FCM token
        // Add to fcmTokens array if not already present
        if (!user.fcmTokens) {
            user.fcmTokens = [];
        }
        if (!user.fcmTokens.includes(fcmToken)) {
            user.fcmTokens.push(fcmToken);
        }
        // Set as primary FCM token
        user.fcmToken = fcmToken;
        yield user.save();
        console.log(`✅ FCM token registered for user: ${user.fullName}`);
        res.json({
            status: true,
            message: 'FCM token registered successfully',
        });
    }
    catch (error) {
        console.error('Error registering FCM token:', error);
        res.status(500).json({
            status: false,
            message: 'Server error',
        });
    }
});
exports.registerFCMToken = registerFCMToken;
/**
 * Remove user's FCM token (for logout)
 */
const removeFCMToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { fcmToken } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!fcmToken) {
            return res.status(400).json({
                status: false,
                message: 'FCM token is required',
            });
        }
        if (!userId) {
            return res.status(401).json({
                status: false,
                message: 'User not authenticated',
            });
        }
        // Remove token from user
        yield user_1.default.findByIdAndUpdate(userId, Object.assign({ $pull: { fcmTokens: fcmToken } }, (fcmToken && { $unset: { fcmToken: '' } })));
        console.log(`🗑️  FCM token removed for user: ${userId}`);
        res.json({
            status: true,
            message: 'FCM token removed successfully',
        });
    }
    catch (error) {
        console.error('Error removing FCM token:', error);
        res.status(500).json({
            status: false,
            message: 'Server error',
        });
    }
});
exports.removeFCMToken = removeFCMToken;
/**
 * Send test notification (for testing purposes)
 */
const sendTestNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return res.status(401).json({
                status: false,
                message: 'User not authenticated',
            });
        }
        const result = yield notificationService_1.default.sendToUser(userId, {
            title: 'Test Notification',
            body: 'This is a test notification from Dunfermline Taxi',
            data: {
                type: 'test',
            },
        });
        if (result.success) {
            res.json({
                status: true,
                message: 'Test notification sent successfully',
            });
        }
        else {
            res.status(400).json({
                status: false,
                message: result.error || 'Failed to send notification',
            });
        }
    }
    catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({
            status: false,
            message: 'Server error',
        });
    }
});
exports.sendTestNotification = sendTestNotification;
/**
 * Send custom notification to a user (admin only)
 */
const sendNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, title, body, data, image } = req.body;
        if (!userId || !title || !body) {
            return res.status(400).json({
                status: false,
                message: 'userId, title, and body are required',
            });
        }
        const result = yield notificationService_1.default.sendToUser(userId, {
            title,
            body,
            data,
            image,
        });
        if (result.success) {
            res.json({
                status: true,
                message: 'Notification sent successfully',
            });
        }
        else {
            res.status(400).json({
                status: false,
                message: result.error || 'Failed to send notification',
            });
        }
    }
    catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({
            status: false,
            message: 'Server error',
        });
    }
});
exports.sendNotification = sendNotification;
/**
 * Send notification to multiple users (admin only)
 */
const sendBulkNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userIds, title, body, data, image } = req.body;
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                status: false,
                message: 'userIds array is required',
            });
        }
        if (!title || !body) {
            return res.status(400).json({
                status: false,
                message: 'title and body are required',
            });
        }
        const result = yield notificationService_1.default.sendToMultipleUsers(userIds, {
            title,
            body,
            data,
            image,
        });
        res.json({
            status: result.success,
            message: `Sent to ${result.successCount} users, ${result.failureCount} failed`,
            successCount: result.successCount,
            failureCount: result.failureCount,
        });
    }
    catch (error) {
        console.error('Error sending bulk notification:', error);
        res.status(500).json({
            status: false,
            message: 'Server error',
        });
    }
});
exports.sendBulkNotification = sendBulkNotification;
/**
 * Send notification to all users of a type (rider or driver)
 */
const sendToUserType = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userType, title, body, data, image } = req.body;
        if (!userType || !title || !body) {
            return res.status(400).json({
                status: false,
                message: 'userType, title, and body are required',
            });
        }
        if (userType !== 'rider' && userType !== 'driver') {
            return res.status(400).json({
                status: false,
                message: 'userType must be either "rider" or "driver"',
            });
        }
        const result = yield notificationService_1.default.sendToUserType(userType, {
            title,
            body,
            data,
            image,
        });
        res.json({
            status: result.success,
            message: `Sent to ${result.successCount} ${userType}s, ${result.failureCount} failed`,
            successCount: result.successCount,
            failureCount: result.failureCount,
        });
    }
    catch (error) {
        console.error('Error sending notification to user type:', error);
        res.status(500).json({
            status: false,
            message: 'Server error',
        });
    }
});
exports.sendToUserType = sendToUserType;
/**
 * Send notification to nearby drivers
 */
const sendToNearbyDrivers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { latitude, longitude, radiusInKm, title, body, data, image } = req.body;
        if (!latitude || !longitude || !radiusInKm || !title || !body) {
            return res.status(400).json({
                status: false,
                message: 'latitude, longitude, radiusInKm, title, and body are required',
            });
        }
        const result = yield notificationService_1.default.sendToNearbyDrivers({ latitude, longitude }, radiusInKm, {
            title,
            body,
            data,
            image,
        });
        res.json({
            status: result.success,
            message: `Sent to ${result.successCount} nearby drivers, ${result.failureCount} failed`,
            successCount: result.successCount,
            failureCount: result.failureCount,
        });
    }
    catch (error) {
        console.error('Error sending notification to nearby drivers:', error);
        res.status(500).json({
            status: false,
            message: 'Server error',
        });
    }
});
exports.sendToNearbyDrivers = sendToNearbyDrivers;
