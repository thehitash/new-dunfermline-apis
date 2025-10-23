import { Request, Response } from 'express';
import Vehicle, { IVehicle } from '../models/vehicle';

/**
 * Get all active vehicles
 * @route GET /api/vehicles
 */
export const getVehicles = async (req: Request, res: Response) => {
  console.log('=== GET VEHICLES REQUEST ===');

  try {
    // Fetch all active vehicles, sorted by capacity
    const vehicles = await Vehicle.find({ isActive: true }).sort({ capacity: 1 });

    console.log(`✅ Found ${vehicles.length} active vehicles`);

    res.json({
      status: true,
      message: 'Vehicles retrieved successfully',
      data: vehicles
    });
  } catch (error) {
    console.error('❌ Get vehicles error:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve vehicles',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Get a single vehicle by ID
 * @route GET /api/vehicles/:id
 */
export const getVehicleById = async (req: Request, res: Response) => {
  const { id } = req.params;

  console.log('=== GET VEHICLE BY ID REQUEST ===');
  console.log('🚗 Vehicle ID:', id);

  try {
    const vehicle = await Vehicle.findById(id);

    if (!vehicle) {
      console.log('❌ Vehicle not found');
      return res.status(404).json({
        status: false,
        message: 'Vehicle not found'
      });
    }

    console.log('✅ Vehicle found:', vehicle.name);

    res.json({
      status: true,
      message: 'Vehicle retrieved successfully',
      data: vehicle
    });
  } catch (error) {
    console.error('❌ Get vehicle by ID error:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve vehicle',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Create a new vehicle (Admin only - for seeding/management)
 * @route POST /api/vehicles
 */
export const createVehicle = async (req: Request, res: Response) => {
  console.log('=== CREATE VEHICLE REQUEST ===');
  console.log('📤 Vehicle Data:', req.body);

  try {
    const vehicle = await Vehicle.create(req.body);

    console.log('✅ Vehicle created:', vehicle.name);

    res.status(201).json({
      status: true,
      message: 'Vehicle created successfully',
      data: vehicle
    });
  } catch (error: any) {
    console.error('❌ Create vehicle error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        status: false,
        message: 'Vehicle with this name already exists'
      });
    }

    res.status(500).json({
      status: false,
      message: 'Failed to create vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Calculate fare estimate for a vehicle
 * @route POST /api/vehicles/:id/calculate-fare
 *
 * Pricing logic:
 * - Rides up to 3 miles: €9 flat rate
 * - Beyond 3 miles: €9 + €3 per additional mile
 * - Example: 4 miles = €9 + (1 × €3) = €12
 */
export const calculateFare = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { distanceMiles, duration } = req.body; // distanceMiles from Google Maps, duration in minutes

  console.log('=== CALCULATE FARE REQUEST ===');
  console.log('🚗 Vehicle ID:', id);
  console.log('📏 Distance (miles):', distanceMiles);
  console.log('⏱️  Duration (min):', duration);

  try {
    const vehicle = await Vehicle.findById(id);

    if (!vehicle) {
      console.log('❌ Vehicle not found');
      return res.status(404).json({
        status: false,
        message: 'Vehicle not found'
      });
    }

    if (!distanceMiles || distanceMiles < 0) {
      console.log('❌ Invalid distance');
      return res.status(400).json({
        status: false,
        message: 'Valid distance in miles is required'
      });
    }

    // Calculate fare based on pricing logic
    let fare: number;
    let additionalMiles = 0;
    let additionalMilesCost = 0;

    if (distanceMiles <= vehicle.baseMileageLimit) {
      // Within base mileage limit - charge flat base fare
      fare = vehicle.baseFare;
      console.log(`📊 Distance ${distanceMiles} miles is within base limit of ${vehicle.baseMileageLimit} miles`);
      console.log(`💷 Charging base fare: £${vehicle.baseFare}`);
    } else {
      // Beyond base mileage limit - charge base fare + additional per mile
      additionalMiles = distanceMiles - vehicle.baseMileageLimit;
      additionalMilesCost = additionalMiles * vehicle.pricePerMileAfterBase;
      fare = vehicle.baseFare + additionalMilesCost;

      console.log(`📊 Distance ${distanceMiles} miles exceeds base limit of ${vehicle.baseMileageLimit} miles`);
      console.log(`📏 Additional miles: ${additionalMiles.toFixed(2)}`);
      console.log(`💷 Base fare: £${vehicle.baseFare}`);
      console.log(`💷 Additional cost: £${additionalMilesCost.toFixed(2)} (${additionalMiles.toFixed(2)} miles × £${vehicle.pricePerMileAfterBase})`);
    }

    const roundedFare = Math.round(fare * 100) / 100; // Round to 2 decimal places
    console.log(`💷 Total fare: £${roundedFare}`);

    res.json({
      status: true,
      message: 'Fare calculated successfully',
      data: {
        vehicleId: vehicle._id,
        vehicleName: vehicle.name,
        distanceMiles,
        duration,
        baseFare: vehicle.baseFare,
        baseMileageLimit: vehicle.baseMileageLimit,
        additionalMiles: Math.round(additionalMiles * 100) / 100,
        additionalMilesCost: Math.round(additionalMilesCost * 100) / 100,
        pricePerMileAfterBase: vehicle.pricePerMileAfterBase,
        totalFare: roundedFare,
        currency: 'GBP'
      }
    });
  } catch (error) {
    console.error('❌ Calculate fare error:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to calculate fare',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};
