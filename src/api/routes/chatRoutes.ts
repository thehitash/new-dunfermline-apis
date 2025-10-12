import express from 'express';
import { getMessages } from '../controllers/chatController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();


/**
 * @swagger
 * /api/chat:
 *   get:
 *     summary: Get chat messages
 *     description: Retrieve chat messages for the authenticated user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                       text:
 *                         type: string
 *                         example: "Hello, how are you?"
 *                       user:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439012"
 *                           name:
 *                             type: string
 *                             example: "John Doe"
 *                           avatar:
 *                             type: string
 *                             example: "https://example.com/avatar.jpg"
 *                       ride:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439013"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2023-01-01T00:00:00.000Z"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Not authorized, no token"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Server Error"
 */
router.get('/', protect, getMessages);


export default router; 