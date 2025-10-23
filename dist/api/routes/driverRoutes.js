"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const driverController_1 = require("../controllers/driverController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/driver/status/{driverId}:
 *   get:
 *     summary: Get driver status
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema:
 *           type: string
 *         description: The driver ID
 *     responses:
 *       200:
 *         description: Driver status retrieved successfully
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Driver not found
 */
router.get('/status/:driverId', authMiddleware_1.protect, driverController_1.getDriverStatus);
/**
 * @swagger
 * /api/driver/location:
 *   post:
 *     summary: Update driver location
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - driverId
 *               - lat
 *               - lng
 *             properties:
 *               driverId:
 *                 type: string
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *     responses:
 *       200:
 *         description: Location updated successfully
 *       400:
 *         description: Driver ID and location are required
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Driver not found
 */
router.post('/location', authMiddleware_1.protect, driverController_1.updateLocation);
/**
 * @swagger
 * /api/driver/location-background:
 *   post:
 *     summary: Update driver location in background
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - driverId
 *               - lat
 *               - lng
 *               - heading
 *               - rideId
 *             properties:
 *               driverId:
 *                 type: string
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *               heading:
 *                 type: number
 *               rideId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Location updated successfully
 *       400:
 *         description: Driver ID and location are required
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Driver not found
 */
router.post('/location-background', authMiddleware_1.protect, driverController_1.updateLocationBackground);
exports.default = router;
