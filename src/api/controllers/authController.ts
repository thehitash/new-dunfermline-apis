import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user';
import OTP from '../models/otp';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { IRequest } from '../middlewares/authMiddleware';

dotenv.config();
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const generateToken = (id: string) => {
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: '7d', // Reduced from 30d for better security
  });
};

export const signup = async (req: Request, res: Response) => {
  const { fullName, email, phoneNumber, password, userType, carName, carNumber, carModel, carColor } = req.body;

  try {
    // Check if user exists with either email or phone number
    const emailExists = await User.findOne({ email });
    const phoneExists = await User.findOne({ phoneNumber });

    if (emailExists) {
      return res.status(400).json({
        message: 'This email is already registered. Please log in to continue.',
        status: false
      });
    }

    if (phoneExists) {
      return res.status(400).json({
        message: 'This phone number is already registered. Please log in to continue.',
        status: false
      });
    }

    const user: IUser = await User.create({
      fullName,
      email,
      phoneNumber,
      password,
      userType,
      ...(userType === 'driver' && {
        carDetails: { carName, carNumber, carModel, carColor }
      }),
    });

    if (user) {
      res.status(201).json({
        status: true,
        message: 'User registered successfully',
      });
    } else {
      res.status(400).json({ message: 'Invalid user data', status: false });
    }
  } catch (error: any) {
    if (error.code === 11000 && error.keyValue) {
      const field = Object.keys(error.keyValue)[0];
      const friendlyField = field === 'phoneNumber' ? 'phone number' : field;
      return res.status(400).json({
        message: `An account with this ${friendlyField} already exists.`,
        status: false
      });
    }
    console.log(error);
    res.status(500).json({ message: 'Server error', status: false });
  }
};

export const login = async (req: Request, res: Response) => {
  const { phoneNumber } = req.body;

  console.log("=== LOGIN REQUEST ===");
  console.log("📞 Phone Number:", phoneNumber);

  try {
    const user = await User.findOne({ phoneNumber });

    console.log("👤 User Found:", user ? `Yes - ${user.fullName}` : "No");

    if (user) {
      // Generate random 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      console.log("🔐 Generated OTP:", otp);
      console.log("⏰ OTP Expiry Time:", new Date(Date.now() + 5 * 60 * 1000).toLocaleString());

      // Delete any existing OTP for this phone number
      const deletedCount = await OTP.deleteMany({ phoneNumber });
      console.log("🗑️  Deleted old OTPs count:", deletedCount.deletedCount);

      // Store OTP in database with 5 minute expiration
      const otpRecord = await OTP.create({
        phoneNumber,
        otp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      });

      console.log("💾 OTP saved to database:", otpRecord._id);

      // Send OTP via Twilio SMS
      try {
        const message = await twilioClient.messages.create({
          body: `Your verification code is: ${otp}. This code will expire in 5 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber,
        });

        console.log('✅ SMS sent successfully via Twilio');
        console.log('📨 Message SID:', message.sid);
        console.log('📱 Sent to:', phoneNumber);

        res.json({
          status: true,
          message: 'OTP sent successfully',
          ...(process.env.NODE_ENV === 'development' && { otp }), // Only expose OTP in development
        });
      } catch (twilioError: any) {
        console.error('❌ Twilio error:', twilioError.message);
        console.log('⚠️  Fallback: OTP generated but SMS not sent');
        console.log('🔐 OTP (for testing):', otp);

        res.json({
          status: true,
          message: 'OTP sent successfully (SMS service unavailable)',
          ...(process.env.NODE_ENV === 'development' && { otp }), // Only expose OTP in development
        });
      }
    } else {
      console.log("❌ User not found for phone:", phoneNumber);
      res.status(404).json({ message: "We couldn't find your account. Please sign up to get started!", status: false });
    }
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ message: 'Server error', status: false });
  }
};

export const sendOTP = async (req: Request, res: Response) => {
  const { phoneNumber } = req.body;

  console.log('=== SEND OTP REQUEST (RESEND) ===');
  console.log('📞 Phone Number:', phoneNumber);

  try {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      console.log('❌ User not found:', phoneNumber);
      return res.status(404).json({ message: 'User not found for phone', status: false });
    }

    console.log('👤 User found:', user.fullName);

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    console.log('🔐 Generated NEW OTP:', otp);
    console.log('⏰ OTP Expiry Time:', new Date(Date.now() + 5 * 60 * 1000).toLocaleString());

    // Delete any existing OTP for this phone number
    const deletedCount = await OTP.deleteMany({ phoneNumber });
    console.log('🗑️  Deleted old OTPs count:', deletedCount.deletedCount);

    // Store OTP in database with 5 minute expiration
    const otpRecord = await OTP.create({
      phoneNumber,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });

    console.log('💾 OTP saved to database:', otpRecord._id);

    // Send OTP via Twilio SMS
    try {
      const message = await twilioClient.messages.create({
        body: `Your Dunfermline Taxi verification code is: ${otp}. Please use this code within 5 minutes to complete your booking.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });

      console.log('✅ SMS sent successfully via Twilio');
      console.log('📨 Message SID:', message.sid);
      console.log('📱 Sent to:', phoneNumber);

      res.json({
        message: 'OTP sent successfully',
        status: true,
        ...(process.env.NODE_ENV === 'development' && { otp }), // Only expose OTP in development
      });
    } catch (twilioError: any) {
      console.error('❌ Twilio error:', twilioError.message);
      console.log('⚠️  Fallback: OTP generated but SMS not sent');
      console.log('🔐 OTP (for testing):', otp);

      // Fallback: return OTP in response if SMS fails (for development)
      res.json({
        message: 'OTP generated (SMS service unavailable)',
        status: true,
        ...(process.env.NODE_ENV === 'development' && { otp }), // Only expose OTP in development
      });
    }
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({ message: 'Server error', status: false });
  }
};

export const verifyOTP = async (req: Request, res: Response) => {
  const { phoneNumber, otp } = req.body;

  console.log('=== VERIFY OTP REQUEST ===');
  console.log('📞 Phone Number:', phoneNumber);
  console.log('🔐 Received OTP:', otp);

  try {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      console.log('❌ User not found:', phoneNumber);
      return res.status(404).json({ message: 'User not found', status: false });
    }

    console.log('👤 User found:', user.fullName);

    // Find the most recent valid OTP for this phone number
    const storedOtpData = await OTP.findOne({
      phoneNumber,
      expiresAt: { $gt: new Date() }, // Not expired
    }).sort({ createdAt: -1 }); // Get the most recent one

    if (!storedOtpData) {
      console.log('❌ OTP not found or expired in database');
      console.log('⏰ Current time:', new Date().toLocaleString());
      return res.status(400).json({ message: 'OTP not found or expired', status: false });
    }

    console.log('💾 Found OTP in database:', storedOtpData.otp);
    console.log('⏰ OTP expires at:', storedOtpData.expiresAt.toLocaleString());
    console.log('🕐 Time remaining:', Math.floor((storedOtpData.expiresAt.getTime() - Date.now()) / 1000), 'seconds');

    // Verify the OTP
    if (otp === storedOtpData.otp) {
      console.log('✅ OTP MATCHED! Verification successful');

      // Clear the OTP after successful verification
      const deletedCount = await OTP.deleteMany({ phoneNumber });
      console.log('🗑️  Cleared OTPs count:', deletedCount.deletedCount);

      const token = generateToken(user._id as string);
      console.log('🎟️  Generated JWT token for user');

      res.json({
        message: 'OTP verified successfully',
        status: true,
        data: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          userType: user.userType,
          isAdmin: user.isAdmin || false, // Include isAdmin field for admin panel
          ...(user.userType === 'driver' && {
            carDetails: user.carDetails
          }),
          token,
        },
      });
    } else {
      console.log('❌ OTP MISMATCH!');
      console.log('Expected:', storedOtpData.otp);
      console.log('Received:', otp);
      res.status(400).json({ message: 'Invalid OTP', status: false });
    }
  } catch (error) {
    console.error('❌ Verify OTP error:', error);
    res.status(500).json({ message: 'Server error', status: false });
  }
};

/**
 * Update user profile
 * @route PUT /api/auth/update-profile
 * @access Private (requires authentication)
 */
export const updateProfile = async (req: IRequest, res: Response) => {
  console.log('=== UPDATE PROFILE REQUEST ===');
  console.log('👤 User ID:', req.user?._id);

  try {
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        message: 'Not authorized. Please log in.',
        status: false
      });
    }

    const userId = req.user._id;
    const {
      fullName,
      email,
      profileImage,
      carName,
      carNumber,
      carModel,
      carColor
    } = req.body;

    console.log('📝 Update fields:', req.body);

    // Find the user
    const user = await User.findById(userId);

    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({
        message: 'User not found',
        status: false
      });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: userId } });
      if (emailExists) {
        console.log('❌ Email already in use:', email);
        return res.status(400).json({
          message: 'This email is already registered to another account.',
          status: false
        });
      }
    }

    // Update fields
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (profileImage) user.profileImage = profileImage;

    // Update car details for drivers
    if (user.userType === 'driver') {
      if (carName || carNumber || carModel || carColor) {
        if (!user.carDetails) {
          user.carDetails = {
            carName: '',
            carNumber: '',
            carModel: '',
            carColor: ''
          };
        }
        if (carName) user.carDetails.carName = carName;
        if (carNumber) user.carDetails.carNumber = carNumber;
        if (carModel) user.carDetails.carModel = carModel;
        if (carColor) user.carDetails.carColor = carColor;
      }
    }

    // Save the updated user
    await user.save();

    console.log('✅ Profile updated successfully for user:', user.fullName);

    // Return updated user data (excluding password)
    const updatedUser = await User.findById(userId).select('-password');

    res.status(200).json({
      message: 'Profile updated successfully',
      status: true,
      data: {
        _id: updatedUser!._id,
        fullName: updatedUser!.fullName,
        email: updatedUser!.email,
        phoneNumber: updatedUser!.phoneNumber,
        userType: updatedUser!.userType,
        profileImage: updatedUser!.profileImage,
        ...(updatedUser!.userType === 'driver' && {
          carDetails: updatedUser!.carDetails
        })
      }
    });
  } catch (error: any) {
    console.error('❌ Update profile error:', error);

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        message: `This ${field} is already registered to another account.`,
        status: false
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      return res.status(400).json({
        message: messages.join('. '),
        status: false
      });
    }

    res.status(500).json({
      message: 'Server error while updating profile',
      status: false
    });
  }
};

/**
 * Get all users by userType (admin only)
 * @route GET /api/auth/users?userType=rider
 * @access Private/Admin
 */
export const getUsersByType = async (req: IRequest, res: Response) => {
  try {
    const { userType } = req.query;

    // Validate userType
    if (!userType || (userType !== 'rider' && userType !== 'driver')) {
      return res.status(400).json({
        message: 'Invalid or missing userType. Must be "rider" or "driver".',
        status: false
      });
    }

    // Fetch users with the specified userType, excluding admins
    const users = await User.find({
      userType,
      $or: [
        { isAdmin: { $exists: false } },
        { isAdmin: false }
      ]
    })
      .select('-password -otp -otpExpiry')
      .sort({ createdAt: -1 });

    console.log(`✅ Fetched ${users.length} ${userType}s`);

    return res.status(200).json({
      message: `${userType}s fetched successfully`,
      status: true,
      data: users,
      total: users.length
    });
  } catch (error: any) {
    console.error('❌ Error fetching users by type:', error);
    return res.status(500).json({
      message: 'Server error while fetching users',
      status: false
    });
  }
};
