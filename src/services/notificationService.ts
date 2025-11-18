import admin from 'firebase-admin';
import path from 'path';
import dotenv from 'dotenv';
import User, { IUser } from '../api/models/user';

dotenv.config();

// Initialize Firebase Admin SDK
let firebaseApp: admin.app.App | null = null;

try {
  // Method 1: From environment variables (RECOMMENDED FOR PRODUCTION)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    console.log('🔧 Initializing Firebase from environment variables...');

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        // Replace \\n with actual newlines in private key
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });

    console.log('✅ Firebase Admin SDK initialized from environment variables');
    console.log('📍 Project ID:', process.env.FIREBASE_PROJECT_ID);
  }
  // Method 2: From JSON file (FOR DEVELOPMENT)
  else {
    console.log('🔧 Initializing Firebase from JSON file...');

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      path.join(__dirname, '../config/firebase-service-account.json');

    const serviceAccount = require(serviceAccountPath);

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin SDK initialized from JSON file');
    console.log('📍 Service account loaded from:', serviceAccountPath);
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error);
  console.log('⚠️  Push notifications will not work without Firebase configuration');
  console.log('');
  console.log('💡 For production, set these environment variables:');
  console.log('   FIREBASE_PROJECT_ID=your-project-id');
  console.log('   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com');
  console.log('   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
  console.log('');
  console.log('💡 For development, ensure firebase-service-account.json is in backend/src/config/');
  console.log('   Or set FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/firebase-service-account.json');
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: { [key: string]: string };
  image?: string;
}

export interface NotificationOptions {
  sound?: string;
  badge?: number;
  priority?: 'high' | 'normal';
  channelId?: string;
}

class NotificationService {
  /**
   * Send push notification to a single user by user ID
   */
  async sendToUser(
    userId: string,
    notification: NotificationPayload,
    options?: NotificationOptions
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase Admin SDK not initialized');
      }

      // Get user's FCM tokens
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      if (!user.fcmToken && (!user.fcmTokens || user.fcmTokens.length === 0)) {
        return { success: false, error: 'User has no FCM tokens' };
      }

      // Get all tokens for the user
      const tokens: string[] = [];
      if (user.fcmToken) tokens.push(user.fcmToken);
      if (user.fcmTokens) tokens.push(...user.fcmTokens);

      // Remove duplicates
      const uniqueTokens = [...new Set(tokens)];

      // Send notification to all tokens
      const result = await this.sendToMultipleTokens(uniqueTokens, notification, options);

      return result;
    } catch (error) {
      console.error('Error sending notification to user:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Send push notification to multiple users by user IDs
   */
  async sendToMultipleUsers(
    userIds: string[],
    notification: NotificationPayload,
    options?: NotificationOptions
  ): Promise<{ success: boolean; successCount: number; failureCount: number }> {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase Admin SDK not initialized');
      }

      // Get all users' FCM tokens
      const users = await User.find({ _id: { $in: userIds } });

      const tokens: string[] = [];
      users.forEach((user) => {
        if (user.fcmToken) tokens.push(user.fcmToken);
        if (user.fcmTokens) tokens.push(...user.fcmTokens);
      });

      // Remove duplicates
      const uniqueTokens = [...new Set(tokens)];

      if (uniqueTokens.length === 0) {
        return { success: false, successCount: 0, failureCount: userIds.length };
      }

      // Send notification
      const result = await this.sendToMultipleTokens(uniqueTokens, notification, options);

      return {
        success: result.success,
        successCount: result.successCount || 0,
        failureCount: result.failureCount || 0,
      };
    } catch (error) {
      console.error('Error sending notification to multiple users:', error);
      return { success: false, successCount: 0, failureCount: userIds.length };
    }
  }

  /**
   * Send push notification to a single FCM token
   */
  async sendToToken(
    token: string,
    notification: NotificationPayload,
    options?: NotificationOptions
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase Admin SDK not initialized');
      }

      const message: admin.messaging.Message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.image && { imageUrl: notification.image }),
        },
        data: notification.data || {},
        android: {
          priority: options?.priority || 'high',
          notification: {
            channelId: options?.channelId || 'dunfermline_taxi_channel',
            sound: options?.sound || 'default',
            priority: 'high',
            ...(notification.image && { imageUrl: notification.image }),
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body,
              },
              sound: options?.sound || 'default',
              badge: options?.badge || 1,
            },
          },
          fcmOptions: {
            ...(notification.image && { imageUrl: notification.image }),
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log('✅ Notification sent successfully:', response);

      return { success: true };
    } catch (error) {
      console.error('Error sending notification:', error);

      // Handle invalid token
      if ((error as any).code === 'messaging/invalid-registration-token' ||
          (error as any).code === 'messaging/registration-token-not-registered') {
        await this.removeInvalidToken(token);
      }

      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Send push notification to multiple FCM tokens
   */
  async sendToMultipleTokens(
    tokens: string[],
    notification: NotificationPayload,
    options?: NotificationOptions
  ): Promise<{ success: boolean; successCount?: number; failureCount?: number; error?: string }> {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase Admin SDK not initialized');
      }

      if (tokens.length === 0) {
        return { success: false, error: 'No tokens provided' };
      }

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.image && { imageUrl: notification.image }),
        },
        data: notification.data || {},
        android: {
          priority: options?.priority || 'high',
          notification: {
            channelId: options?.channelId || 'dunfermline_taxi_channel',
            sound: options?.sound || 'default',
            priority: 'high',
            ...(notification.image && { imageUrl: notification.image }),
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body,
              },
              sound: options?.sound || 'default',
              badge: options?.badge || 1,
            },
          },
          fcmOptions: {
            ...(notification.image && { imageUrl: notification.image }),
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

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
    } catch (error) {
      console.error('Error sending notifications to multiple tokens:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Send notification to all users of a specific type (rider or driver)
   */
  async sendToUserType(
    userType: 'rider' | 'driver',
    notification: NotificationPayload,
    options?: NotificationOptions
  ): Promise<{ success: boolean; successCount: number; failureCount: number }> {
    try {
      const users = await User.find({ userType });
      const userIds = users.map((user) => (user._id as any).toString());

      return await this.sendToMultipleUsers(userIds, notification, options);
    } catch (error) {
      console.error(`Error sending notification to ${userType}s:`, error);
      return { success: false, successCount: 0, failureCount: 0 };
    }
  }

  /**
   * Send notification to all drivers within a radius
   */
  async sendToNearbyDrivers(
    location: { latitude: number; longitude: number },
    radiusInKm: number,
    notification: NotificationPayload,
    options?: NotificationOptions
  ): Promise<{ success: boolean; successCount: number; failureCount: number }> {
    try {
      // Find drivers within radius using geospatial query
      const drivers = await User.find({
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

      const driverIds = drivers.map((driver) => (driver._id as any).toString());

      if (driverIds.length === 0) {
        return { success: false, successCount: 0, failureCount: 0 };
      }

      return await this.sendToMultipleUsers(driverIds, notification, options);
    } catch (error) {
      console.error('Error sending notification to nearby drivers:', error);
      return { success: false, successCount: 0, failureCount: 0 };
    }
  }

  /**
   * Remove invalid FCM token from database
   */
  private async removeInvalidToken(token: string): Promise<void> {
    try {
      await User.updateMany(
        {
          $or: [
            { fcmToken: token },
            { fcmTokens: token },
          ],
        },
        {
          $pull: { fcmTokens: token },
          $unset: { fcmToken: '' },
        }
      );

      console.log(`🗑️  Removed invalid FCM token: ${token.substring(0, 20)}...`);
    } catch (error) {
      console.error('Error removing invalid token:', error);
    }
  }

  /**
   * Subscribe user to a topic
   */
  async subscribeToTopic(
    tokens: string | string[],
    topic: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase Admin SDK not initialized');
      }

      const tokensArray = Array.isArray(tokens) ? tokens : [tokens];

      const response = await admin.messaging().subscribeToTopic(tokensArray, topic);

      if (response.failureCount > 0) {
        console.log(`⚠️  ${response.failureCount} tokens failed to subscribe to topic ${topic}`);
      }

      console.log(`✅ Subscribed ${response.successCount} tokens to topic: ${topic}`);

      return { success: response.successCount > 0 };
    } catch (error) {
      console.error('Error subscribing to topic:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Unsubscribe user from a topic
   */
  async unsubscribeFromTopic(
    tokens: string | string[],
    topic: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase Admin SDK not initialized');
      }

      const tokensArray = Array.isArray(tokens) ? tokens : [tokens];

      const response = await admin.messaging().unsubscribeFromTopic(tokensArray, topic);

      console.log(`✅ Unsubscribed ${response.successCount} tokens from topic: ${topic}`);

      return { success: response.successCount > 0 };
    } catch (error) {
      console.error('Error unsubscribing from topic:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Send notification to a topic
   */
  async sendToTopic(
    topic: string,
    notification: NotificationPayload,
    options?: NotificationOptions
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!firebaseApp) {
        throw new Error('Firebase Admin SDK not initialized');
      }

      const message: admin.messaging.Message = {
        topic,
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.image && { imageUrl: notification.image }),
        },
        data: notification.data || {},
        android: {
          priority: options?.priority || 'high',
          notification: {
            channelId: options?.channelId || 'dunfermline_taxi_channel',
            sound: options?.sound || 'default',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: options?.sound || 'default',
              badge: options?.badge || 1,
            },
          },
        },
      };

      const messageId = await admin.messaging().send(message);

      console.log(`✅ Notification sent to topic ${topic}:`, messageId);

      return { success: true, messageId };
    } catch (error) {
      console.error('Error sending notification to topic:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}

// Export singleton instance
export default new NotificationService();
