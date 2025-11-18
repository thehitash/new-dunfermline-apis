import { Router } from 'express';
import { getSettings, toggleMaintenanceMode, getMaintenanceStatus } from '../controllers/settingsController';
import { protect, adminOnly } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @swagger
 * /api/settings/maintenance-status:
 *   get:
 *     summary: Get current maintenance status (public)
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Maintenance status retrieved
 */
router.get('/maintenance-status', getMaintenanceStatus);

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get all settings (admin only)
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *       403:
 *         description: Admin privileges required
 */
router.get('/', protect, adminOnly, getSettings);

/**
 * @swagger
 * /api/settings/maintenance-mode:
 *   put:
 *     summary: Toggle maintenance mode (admin only)
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maintenanceMode:
 *                 type: boolean
 *               maintenanceMessage:
 *                 type: string
 *               affectedServices:
 *                 type: array
 *                 items:
 *                   type: string
 *               maintenanceStartTime:
 *                 type: string
 *                 format: date-time
 *               maintenanceEndTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Maintenance mode toggled successfully
 *       403:
 *         description: Admin privileges required
 */
router.put('/maintenance-mode', protect, adminOnly, toggleMaintenanceMode);

export default router;
