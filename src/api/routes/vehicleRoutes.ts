import express from 'express';
import * as vehicleController from '../controllers/vehicleController';
import { protect, adminOnly } from '../middlewares/authMiddleware';

const router = express.Router();

/**
 * @route   GET /api/vehicles
 * @desc    Get all active vehicles
 * @access  Public
 */
router.get('/', vehicleController.getVehicles);

/**
 * @route   GET /api/vehicles/:id
 * @desc    Get vehicle by ID
 * @access  Public
 */
router.get('/:id', vehicleController.getVehicleById);

/**
 * @route   POST /api/vehicles
 * @desc    Create a new vehicle
 * @access  Admin (for now public for seeding)
 */
router.post('/', protect, adminOnly, vehicleController.createVehicle);

/**
 * @route   PUT /api/vehicles/:id
 * @desc    Update vehicle pricing and details
 * @access  Admin
 */
router.put('/:id', protect, adminOnly, vehicleController.updateVehicle);

/**
 * @route   POST /api/vehicles/:id/calculate-fare
 * @desc    Calculate fare estimate for a vehicle
 * @access  Public
 */
router.post('/:id/calculate-fare', vehicleController.calculateFare);

export default router;
