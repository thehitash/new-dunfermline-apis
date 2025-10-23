import { Request, Response } from 'express';
import User from '../models/user';
import notificationService from '../../services/notificationService';

/**
 * Register or update user's FCM token
 */
export const registerFCMToken = async (req: Request, res: Response) => {
  try {
    const { fcmToken } = req.body;
    const userId = (req as any).user?.id; // From auth middleware

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
    const user = await User.findById(userId);

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

    await user.save();

    console.log(`✅ FCM token registered for user: ${user.fullName}`);

    res.json({
      status: true,
      message: 'FCM token registered successfully',
    });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({
      status: false,
      message: 'Server error',
    });
  }
};

/**
 * Remove user's FCM token (for logout)
 */
export const removeFCMToken = async (req: Request, res: Response) => {
  try {
    const { fcmToken } = req.body;
    const userId = (req as any).user?.id;

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
    await User.findByIdAndUpdate(userId, {
      $pull: { fcmTokens: fcmToken },
      ...(fcmToken && { $unset: { fcmToken: '' } }),
    });

    console.log(`🗑️  FCM token removed for user: ${userId}`);

    res.json({
      status: true,
      message: 'FCM token removed successfully',
    });
  } catch (error) {
    console.error('Error removing FCM token:', error);
    res.status(500).json({
      status: false,
      message: 'Server error',
    });
  }
};

/**
 * Send test notification (for testing purposes)
 */
export const sendTestNotification = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: 'User not authenticated',
      });
    }

    const result = await notificationService.sendToUser(
      userId,
      {
        title: 'Test Notification',
        body: 'This is a test notification from Dunfermline Taxi',
        data: {
          type: 'test',
        },
      }
    );

    if (result.success) {
      res.json({
        status: true,
        message: 'Test notification sent successfully',
      });
    } else {
      res.status(400).json({
        status: false,
        message: result.error || 'Failed to send notification',
      });
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      status: false,
      message: 'Server error',
    });
  }
};

/**
 * Send custom notification to a user (admin only)
 */
export const sendNotification = async (req: Request, res: Response) => {
  try {
    const { userId, title, body, data, image } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({
        status: false,
        message: 'userId, title, and body are required',
      });
    }

    const result = await notificationService.sendToUser(
      userId,
      {
        title,
        body,
        data,
        image,
      }
    );

    if (result.success) {
      res.json({
        status: true,
        message: 'Notification sent successfully',
      });
    } else {
      res.status(400).json({
        status: false,
        message: result.error || 'Failed to send notification',
      });
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      status: false,
      message: 'Server error',
    });
  }
};

/**
 * Send notification to multiple users (admin only)
 */
export const sendBulkNotification = async (req: Request, res: Response) => {
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

    const result = await notificationService.sendToMultipleUsers(
      userIds,
      {
        title,
        body,
        data,
        image,
      }
    );

    res.json({
      status: result.success,
      message: `Sent to ${result.successCount} users, ${result.failureCount} failed`,
      successCount: result.successCount,
      failureCount: result.failureCount,
    });
  } catch (error) {
    console.error('Error sending bulk notification:', error);
    res.status(500).json({
      status: false,
      message: 'Server error',
    });
  }
};

/**
 * Send notification to all users of a type (rider or driver)
 */
export const sendToUserType = async (req: Request, res: Response) => {
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

    const result = await notificationService.sendToUserType(
      userType,
      {
        title,
        body,
        data,
        image,
      }
    );

    res.json({
      status: result.success,
      message: `Sent to ${result.successCount} ${userType}s, ${result.failureCount} failed`,
      successCount: result.successCount,
      failureCount: result.failureCount,
    });
  } catch (error) {
    console.error('Error sending notification to user type:', error);
    res.status(500).json({
      status: false,
      message: 'Server error',
    });
  }
};

/**
 * Send notification to nearby drivers
 */
export const sendToNearbyDrivers = async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, radiusInKm, title, body, data, image } = req.body;

    if (!latitude || !longitude || !radiusInKm || !title || !body) {
      return res.status(400).json({
        status: false,
        message: 'latitude, longitude, radiusInKm, title, and body are required',
      });
    }

    const result = await notificationService.sendToNearbyDrivers(
      { latitude, longitude },
      radiusInKm,
      {
        title,
        body,
        data,
        image,
      }
    );

    res.json({
      status: result.success,
      message: `Sent to ${result.successCount} nearby drivers, ${result.failureCount} failed`,
      successCount: result.successCount,
      failureCount: result.failureCount,
    });
  } catch (error) {
    console.error('Error sending notification to nearby drivers:', error);
    res.status(500).json({
      status: false,
      message: 'Server error',
    });
  }
};

/**
 * Send promotional notification to all riders
 * Example: "Book Now - Get 10% Off!"
 */
export const sendPromotionalNotification = async (req: Request, res: Response) => {
  try {
    const { title, body, data, image, userType } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        status: false,
        message: 'title and body are required',
      });
    }

    // Default to riders if not specified
    const targetUserType = userType || 'rider';

    if (targetUserType !== 'rider' && targetUserType !== 'driver') {
      return res.status(400).json({
        status: false,
        message: 'userType must be either "rider" or "driver"',
      });
    }

    console.log(`📢 Sending promotional notification to all ${targetUserType}s`);
    console.log(`📢 Title: ${title}`);
    console.log(`📢 Body: ${body}`);

    const result = await notificationService.sendToUserType(
      targetUserType,
      {
        title,
        body,
        data: {
          type: 'promotional',
          ...data,
        },
        image,
      },
      {
        channelId: 'dunfermline_taxi_channel',
        priority: 'high',
      }
    );

    console.log(`✅ Promotional notification sent - Success: ${result.successCount}, Failed: ${result.failureCount}`);

    res.json({
      status: result.success,
      message: `Promotional notification sent to ${result.successCount} ${targetUserType}s, ${result.failureCount} failed`,
      successCount: result.successCount,
      failureCount: result.failureCount,
    });
  } catch (error) {
    console.error('Error sending promotional notification:', error);
    res.status(500).json({
      status: false,
      message: 'Server error',
    });
  }
};

/**
 * Send notification to all users (riders and drivers)
 */
export const sendToAllUsers = async (req: Request, res: Response) => {
  try {
    const { title, body, data, image } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        status: false,
        message: 'title and body are required',
      });
    }

    console.log(`📢 Sending notification to ALL users`);
    console.log(`📢 Title: ${title}`);
    console.log(`📢 Body: ${body}`);

    // Get all users
    const allUsers = await User.find({}, { _id: 1 });
    const userIds = allUsers.map(user => (user._id as any).toString());

    console.log(`📍 Found ${userIds.length} total users`);

    const result = await notificationService.sendToMultipleUsers(
      userIds,
      {
        title,
        body,
        data: {
          type: 'announcement',
          ...data,
        },
        image,
      },
      {
        channelId: 'dunfermline_taxi_channel',
        priority: 'high',
      }
    );

    console.log(`✅ Notification sent to all users - Success: ${result.successCount}, Failed: ${result.failureCount}`);

    res.json({
      status: result.success,
      message: `Notification sent to ${result.successCount} users, ${result.failureCount} failed`,
      successCount: result.successCount,
      failureCount: result.failureCount,
      totalUsers: userIds.length,
    });
  } catch (error) {
    console.error('Error sending notification to all users:', error);
    res.status(500).json({
      status: false,
      message: 'Server error',
    });
  }
};
