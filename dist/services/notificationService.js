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
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const user_1 = __importDefault(require("../api/models/user"));
dotenv_1.default.config();
// Initialize Firebase Admin SDK
let firebaseApp = null;
try {
    // Try to get path from environment variable first, then fallback to default location
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
        path_1.default.join(__dirname, '../config/firebase-service-account.json');
    const serviceAccount = require(serviceAccountPath);
    firebaseApp = firebase_admin_1.default.initializeApp({
        credential: firebase_admin_1.default.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
    console.log('📍 Service account loaded from:', serviceAccountPath);
}
catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error);
    console.log('⚠️  Push notifications will not work without Firebase configuration');
    console.log('💡 Please ensure firebase-service-account.json is in backend/src/config/ directory');
    console.log('💡 Or set FIREBASE_SERVICE_ACCOUNT_PATH in your .env file');
}
class NotificationService {
    /**
     * Send push notification to a single user by user ID
     */
    sendToUser(userId, notification, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!firebaseApp) {
                    throw new Error('Firebase Admin SDK not initialized');
                }
                // Get user's FCM tokens
                const user = yield user_1.default.findById(userId);
                if (!user) {
                    return { success: false, error: 'User not found' };
                }
                if (!user.fcmToken && (!user.fcmTokens || user.fcmTokens.length === 0)) {
                    return { success: false, error: 'User has no FCM tokens' };
                }
                // Get all tokens for the user
                const tokens = [];
                if (user.fcmToken)
                    tokens.push(user.fcmToken);
                if (user.fcmTokens)
                    tokens.push(...user.fcmTokens);
                // Remove duplicates
                const uniqueTokens = [...new Set(tokens)];
                // Send notification to all tokens
                const result = yield this.sendToMultipleTokens(uniqueTokens, notification, options);
                return result;
            }
            catch (error) {
                console.error('Error sending notification to user:', error);
                return { success: false, error: error.message };
            }
        });
    }
    /**
     * Send push notification to multiple users by user IDs
     */
    sendToMultipleUsers(userIds, notification, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!firebaseApp) {
                    throw new Error('Firebase Admin SDK not initialized');
                }
                // Get all users' FCM tokens
                const users = yield user_1.default.find({ _id: { $in: userIds } });
                const tokens = [];
                users.forEach((user) => {
                    if (user.fcmToken)
                        tokens.push(user.fcmToken);
                    if (user.fcmTokens)
                        tokens.push(...user.fcmTokens);
                });
                // Remove duplicates
                const uniqueTokens = [...new Set(tokens)];
                if (uniqueTokens.length === 0) {
                    return { success: false, successCount: 0, failureCount: userIds.length };
                }
                // Send notification
                const result = yield this.sendToMultipleTokens(uniqueTokens, notification, options);
                return {
                    success: result.success,
                    successCount: result.successCount || 0,
                    failureCount: result.failureCount || 0,
                };
            }
            catch (error) {
                console.error('Error sending notification to multiple users:', error);
                return { success: false, successCount: 0, failureCount: userIds.length };
            }
        });
    }
    /**
     * Send push notification to a single FCM token
     */
    sendToToken(token, notification, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!firebaseApp) {
                    throw new Error('Firebase Admin SDK not initialized');
                }
                const message = {
                    token,
                    notification: Object.assign({ title: notification.title, body: notification.body }, (notification.image && { imageUrl: notification.image })),
                    data: notification.data || {},
                    android: {
                        priority: (options === null || options === void 0 ? void 0 : options.priority) || 'high',
                        notification: Object.assign({ channelId: (options === null || options === void 0 ? void 0 : options.channelId) || 'dunfermline_taxi_channel', sound: (options === null || options === void 0 ? void 0 : options.sound) || 'default', priority: 'high' }, (notification.image && { imageUrl: notification.image })),
                    },
                    apns: {
                        payload: {
                            aps: {
                                alert: {
                                    title: notification.title,
                                    body: notification.body,
                                },
                                sound: (options === null || options === void 0 ? void 0 : options.sound) || 'default',
                                badge: (options === null || options === void 0 ? void 0 : options.badge) || 1,
                            },
                        },
                        fcmOptions: Object.assign({}, (notification.image && { imageUrl: notification.image })),
                    },
                };
                const response = yield firebase_admin_1.default.messaging().send(message);
                console.log('✅ Notification sent successfully:', response);
                return { success: true };
            }
            catch (error) {
                console.error('Error sending notification:', error);
                // Handle invalid token
                if (error.code === 'messaging/invalid-registration-token' ||
                    error.code === 'messaging/registration-token-not-registered') {
                    yield this.removeInvalidToken(token);
                }
                return { success: false, error: error.message };
            }
        });
    }
    /**
     * Send push notification to multiple FCM tokens
     */
    sendToMultipleTokens(tokens, notification, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!firebaseApp) {
                    throw new Error('Firebase Admin SDK not initialized');
                }
                if (tokens.length === 0) {
                    return { success: false, error: 'No tokens provided' };
                }
                const message = {
                    tokens,
                    notification: Object.assign({ title: notification.title, body: notification.body }, (notification.image && { imageUrl: notification.image })),
                    data: notification.data || {},
                    android: {
                        priority: (options === null || options === void 0 ? void 0 : options.priority) || 'high',
                        notification: Object.assign({ channelId: (options === null || options === void 0 ? void 0 : options.channelId) || 'dunfermline_taxi_channel', sound: (options === null || options === void 0 ? void 0 : options.sound) || 'default', priority: 'high' }, (notification.image && { imageUrl: notification.image })),
                    },
                    apns: {
                        payload: {
                            aps: {
                                alert: {
                                    title: notification.title,
                                    body: notification.body,
                                },
                                sound: (options === null || options === void 0 ? void 0 : options.sound) || 'default',
                                badge: (options === null || options === void 0 ? void 0 : options.badge) || 1,
                            },
                        },
                        fcmOptions: Object.assign({}, (notification.image && { imageUrl: notification.image })),
                    },
                };
                const response = yield firebase_admin_1.default.messaging().sendEachForMulticast(message);
                console.log(`✅ Sent ${response.successCount} notifications successfully`);
                if (response.failureCount > 0) {
                    console.log(`❌ ${response.failureCount} notifications failed`);
                    // Remove invalid tokens
                    response.responses.forEach((resp, idx) => {
                        if (!resp.success && resp.error) {
                            const errorCode = resp.error.code;
                            if (errorCode === 'messaging/invalid-registration-token' ||
                                errorCode === 'messaging/registration-token-not-registered') {
                                this.removeInvalidToken(tokens[idx]);
                            }
                        }
                    });
                }
                return {
                    success: response.successCount > 0,
                    successCount: response.successCount,
                    failureCount: response.failureCount,
                };
            }
            catch (error) {
                console.error('Error sending notifications to multiple tokens:', error);
                return { success: false, error: error.message };
            }
        });
    }
    /**
     * Send notification to all users of a specific type (rider or driver)
     */
    sendToUserType(userType, notification, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const users = yield user_1.default.find({ userType });
                const userIds = users.map((user) => user._id.toString());
                return yield this.sendToMultipleUsers(userIds, notification, options);
            }
            catch (error) {
                console.error(`Error sending notification to ${userType}s:`, error);
                return { success: false, successCount: 0, failureCount: 0 };
            }
        });
    }
    /**
     * Send notification to all drivers within a radius
     */
    sendToNearbyDrivers(location, radiusInKm, notification, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Find drivers within radius using geospatial query
                const drivers = yield user_1.default.find({
                    userType: 'driver',
                    location: {
                        $near: {
                            $geometry: {
                                type: 'Point',
                                coordinates: [location.longitude, location.latitude],
                            },
                            $maxDistance: radiusInKm * 1000, // Convert km to meters
                        },
                    },
                });
                const driverIds = drivers.map((driver) => driver._id.toString());
                if (driverIds.length === 0) {
                    return { success: false, successCount: 0, failureCount: 0 };
                }
                return yield this.sendToMultipleUsers(driverIds, notification, options);
            }
            catch (error) {
                console.error('Error sending notification to nearby drivers:', error);
                return { success: false, successCount: 0, failureCount: 0 };
            }
        });
    }
    /**
     * Remove invalid FCM token from database
     */
    removeInvalidToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield user_1.default.updateMany({
                    $or: [
                        { fcmToken: token },
                        { fcmTokens: token },
                    ],
                }, {
                    $pull: { fcmTokens: token },
                    $unset: { fcmToken: '' },
                });
                console.log(`🗑️  Removed invalid FCM token: ${token.substring(0, 20)}...`);
            }
            catch (error) {
                console.error('Error removing invalid token:', error);
            }
        });
    }
    /**
     * Subscribe user to a topic
     */
    subscribeToTopic(tokens, topic) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!firebaseApp) {
                    throw new Error('Firebase Admin SDK not initialized');
                }
                const tokensArray = Array.isArray(tokens) ? tokens : [tokens];
                const response = yield firebase_admin_1.default.messaging().subscribeToTopic(tokensArray, topic);
                if (response.failureCount > 0) {
                    console.log(`⚠️  ${response.failureCount} tokens failed to subscribe to topic ${topic}`);
                }
                console.log(`✅ Subscribed ${response.successCount} tokens to topic: ${topic}`);
                return { success: response.successCount > 0 };
            }
            catch (error) {
                console.error('Error subscribing to topic:', error);
                return { success: false, error: error.message };
            }
        });
    }
    /**
     * Unsubscribe user from a topic
     */
    unsubscribeFromTopic(tokens, topic) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!firebaseApp) {
                    throw new Error('Firebase Admin SDK not initialized');
                }
                const tokensArray = Array.isArray(tokens) ? tokens : [tokens];
                const response = yield firebase_admin_1.default.messaging().unsubscribeFromTopic(tokensArray, topic);
                console.log(`✅ Unsubscribed ${response.successCount} tokens from topic: ${topic}`);
                return { success: response.successCount > 0 };
            }
            catch (error) {
                console.error('Error unsubscribing from topic:', error);
                return { success: false, error: error.message };
            }
        });
    }
    /**
     * Send notification to a topic
     */
    sendToTopic(topic, notification, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!firebaseApp) {
                    throw new Error('Firebase Admin SDK not initialized');
                }
                const message = {
                    topic,
                    notification: Object.assign({ title: notification.title, body: notification.body }, (notification.image && { imageUrl: notification.image })),
                    data: notification.data || {},
                    android: {
                        priority: (options === null || options === void 0 ? void 0 : options.priority) || 'high',
                        notification: {
                            channelId: (options === null || options === void 0 ? void 0 : options.channelId) || 'dunfermline_taxi_channel',
                            sound: (options === null || options === void 0 ? void 0 : options.sound) || 'default',
                            priority: 'high',
                        },
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: (options === null || options === void 0 ? void 0 : options.sound) || 'default',
                                badge: (options === null || options === void 0 ? void 0 : options.badge) || 1,
                            },
                        },
                    },
                };
                const messageId = yield firebase_admin_1.default.messaging().send(message);
                console.log(`✅ Notification sent to topic ${topic}:`, messageId);
                return { success: true, messageId };
            }
            catch (error) {
                console.error('Error sending notification to topic:', error);
                return { success: false, error: error.message };
            }
        });
    }
}
// Export singleton instance
exports.default = new NotificationService();
