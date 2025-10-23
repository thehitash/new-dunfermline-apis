"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rideController_1 = require("../controllers/rideController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/ride/request:
 *   post:
 *     summary: Request a new ride
 *     tags: [Ride]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pickup
 *               - destination
 *             properties:
 *               pickup:
 *                 type: object
 *                 required:
 *                   - latitude
 *                   - longitude
 *                 properties:
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *               destination:
 *                 type: object
 *                 required:
 *                   - latitude
 *                   - longitude
 *                 properties:
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *     responses:
 *       201:
 *         description: Ride requested successfully
 *       400:
 *         description: Pickup and destination locations are required
 *       401:
 *         description: Not authorized
 */
router.post('/request', authMiddleware_1.protect, rideController_1.requestRide);
/**
 * @swagger
 * /api/ride/accept-reject:
 *   post:
 *     summary: Accept a ride request
 *     tags: [Ride]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rideId
 *               - status
 *             properties:
 *               rideId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum:
 *                   - accepted
 *                   - rejected
 *     responses:
 *       200:
 *         description: Ride accepted successfully
 *       400:
 *         description: Ride already accepted
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Ride not found
 */
router.put('/accept-reject', authMiddleware_1.protect, rideController_1.acceptRejectRide);
/**
 * @swagger
 * /api/ride/all-driver-rides:
 *   get:
 *     summary: Get all driver rides
 *     tags: [Ride]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rides fetched successfully
 *       401:
 *         description: Not authorized
 */
router.get('/all-driver-rides', authMiddleware_1.protect, rideController_1.allDriverRides);
/**
 * @swagger
 * /api/ride/all-rider-rides:
 *   get:
 *     summary: Get all rider rides
 *     tags: [Ride]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rides fetched successfully
 *       401:
 *         description: Not authorized
 */
router.get('/all-rider-rides', authMiddleware_1.protect, rideController_1.allRiderRides);
/**
 * @swagger
 * /api/ride/pending-rides:
 *   get:
 *     summary: Get pending rides
 *     tags: [Ride]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rides fetched successfully
 *       401:
 *         description: Not authorized
 */
router.get('/pending-rides', authMiddleware_1.protect, rideController_1.pendingRides);
/**
 * @swagger
 * /api/ride/{rideId}:
 *   get:
 *     summary: Get a ride by ID
 *     tags: [Ride]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: rideId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ride fetched successfully
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Ride not found
 */
router.get('/:rideId', authMiddleware_1.protect, rideController_1.getRideById);
/**
 * @swagger
 * /api/ride/cancel/{rideId}:
 *   put:
 *     summary: Cancel a ride
 *     tags: [Ride]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: rideId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ride cancelled successfully
 *       400:
 *         description: Ride cannot be cancelled at this stage
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You are not authorized to cancel this ride
 *       404:
 *         description: Ride not found
 */
router.put('/cancel/:rideId', authMiddleware_1.protect, rideController_1.cancelRide);
exports.default = router;
