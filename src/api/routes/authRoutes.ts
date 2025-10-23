import { Router } from 'express';
import { signup, login, verifyOTP, sendOTP, updateProfile, getUsersByType } from '../controllers/authController';
import { authLimiter, otpVerifyLimiter } from '../middlewares/rateLimiter';
import { protect, adminOnly } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - phoneNumber
 *               - password
 *               - userType
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *               userType:
 *                 type: string
 *                 enum: [rider, driver]
 *               carName:
 *                 type: string
 *               carNumber:
 *                 type: string
 *               carModel:
 *                 type: string
 *               carColor:
    *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: User already exists or invalid data
 */
router.post('/signup', authLimiter, signup);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 format: phoneNumber
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       401:
 *         description: User not found
 */
router.post('/login', authLimiter, login);

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     summary: Send OTP to user's phoneNumber
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:    
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 format: phoneNumber
 *     responses:   
 *       200:
 *         description: OTP sent successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error    
 */ 
router.post('/send-otp', authLimiter, sendOTP);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP for user's phoneNumber
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - otp
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 format: phoneNumber
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP
 *       500:
 *         description: Server error
 */
router.post('/verify-otp', otpVerifyLimiter, verifyOTP);

/**
 * @swagger
 * /api/auth/update-profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: User's full name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               profileImage:
 *                 type: string
 *                 description: URL to profile image
 *               carName:
 *                 type: string
 *                 description: Car name (drivers only)
 *               carNumber:
 *                 type: string
 *                 description: Car registration number (drivers only)
 *               carModel:
 *                 type: string
 *                 description: Car model (drivers only)
 *               carColor:
 *                 type: string
 *                 description: Car color (drivers only)
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid data or email already in use
 *       401:
 *         description: Not authorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put('/update-profile', protect, updateProfile);

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Get all users by userType (admin only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [rider, driver]
 *         description: Type of users to fetch
 *     responses:
 *       200:
 *         description: Users fetched successfully
 *       400:
 *         description: Invalid userType
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Admin privileges required
 *       500:
 *         description: Server error
 */
router.get('/users', protect, adminOnly, getUsersByType);

export default router; 