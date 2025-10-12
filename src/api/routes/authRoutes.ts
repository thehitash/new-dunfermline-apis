import { Router } from 'express';
import { signup, login, verifyOTP, sendOTP } from '../controllers/authController';

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
router.post('/signup', signup);

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
router.post('/login', login);

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
router.post('/send-otp', sendOTP);

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
router.post('/verify-otp', verifyOTP);


export default router; 