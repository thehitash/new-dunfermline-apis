import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your_jwt_secret', {
    expiresIn: '30d',
  });
};

export const signup = async (req: Request, res: Response) => {
  const { fullName, email, phoneNumber, password, userType, carName, carNumber, carModel, carColor } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'This email is already registered. Please log in to continue.' });

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
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error: any) {
    if (error.code === 11000 && error.keyValue) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ message: `An account with this ${field} already exists.` });
    }
    console.log(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { phoneNumber } = req.body;

  console.log("=== LOGIN REQUEST ===");
  console.log("phoneNumber", phoneNumber);

  try {
    const user = await User.findOne({ phoneNumber });

    console.log("user", user);
    if (user) {
      // Generate random 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      console.log('===========================================');
      console.log('📱 LOGIN OTP FOR', phoneNumber, ':', otp);
      console.log('===========================================');

      // Store OTP with 5 minute expiration
      otpStore[phoneNumber] = {
        otp,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };

      // Send OTP via Twilio SMS
      try {
        const message = await twilioClient.messages.create({
          body: `Your verification code is: ${otp}. This code will expire in 5 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber,
        });

        console.log('✅ SMS sent successfully via Twilio. SID:', message.sid);

        res.json({
          status: true,
          message: 'OTP sent successfully',
          otp: otp, // For development
        });
      } catch (twilioError: any) {
        console.error('❌ Twilio error:', twilioError.message);
        console.log('OTP (Twilio failed):', otp);

        res.json({
          status: true,
          message: 'OTP sent successfully',
          otp: otp, // For development
        });
      }
    } else {
      res.status(404).json({ message: 'We couldn’t find your account. Please sign up to get started!', status: false });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', status: false });
  }
};

// Store OTPs temporarily (in production, use Redis or database)
const otpStore: { [key: string]: { otp: string; expiresAt: number } } = {};

export const sendOTP = async (req: Request, res: Response) => {
  const { phoneNumber } = req.body;

  console.log('=== SEND OTP REQUEST ===');
  console.log('Phone Number:', phoneNumber);

  try {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      console.log('User not found :', phoneNumber);
      return res.status(404).json({ message: 'User not found for phone', status: false });
    }

    console.log('User found:', user.fullName);

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('===========================================');
    console.log('📱 GENERATED OTP FOR', phoneNumber, ':', otp);
    console.log('===========================================');

    // Store OTP with 5 minute expiration
    otpStore[phoneNumber] = {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    };

    // Send OTP via Twilio SMS
    try {
      const message = await twilioClient.messages.create({
        body: `Your Dunfermline Taxi verification code is: ${otp}. Please use this code within 5 minutes to complete your booking.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });

      console.log('✅ SMS sent successfully via Twilio. SID:', message.sid);
      console.log('OTP:', otp);

      res.json({
        message: 'OTP sent successfully',
        status: true,
        otp: otp, // For development - see OTP in response
      });
    } catch (twilioError: any) {
      console.error('❌ Twilio error:', twilioError.message);
      console.log('OTP (Twilio failed):', otp);
      // Fallback: return OTP in response if SMS fails (for development)
      res.json({
        message: 'OTP generated (SMS failed)',
        otp: otp,
        status: true,
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error', status: false });
  }
};

export const verifyOTP = async (req: Request, res: Response) => {
  const { phoneNumber, otp } = req.body;

  try {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res.status(404).json({ message: 'User not found', status: false });
    }

    console.log('otp', otp);

    // Check if OTP exists and is not expired
    const storedOtpData = otpStore[phoneNumber];

    if (!storedOtpData) {
      return res.status(400).json({ message: 'OTP not found or expired', status: false });
    }

    if (Date.now() > storedOtpData.expiresAt) {
      delete otpStore[phoneNumber];
      return res.status(400).json({ message: 'OTP expired', status: false });
    }

    // Verify the OTP
    if (otp === storedOtpData.otp) {
      // Clear the OTP after successful verification
      delete otpStore[phoneNumber];

      res.json({
        message: 'OTP verified successfully',
        status: true,
        data: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          userType: user.userType,
          ...(user.userType === 'driver' && {
            carDetails: user.carDetails
          }),
          token: generateToken(user._id as string),
        },
      });
    } else {
      console.log('Invalid OTP');
      res.status(400).json({ message: 'Invalid OTP', status: false });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error', status: false });
  }
};
