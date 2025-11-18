import { Response } from 'express';
import User from '../models/user';
import Ride from '../models/ride';
import { IRequest } from '../middlewares/authMiddleware';
import { getIO } from '../../socket/socketInstance';
import { calculateDistanceInMeters, estimateTimeToReach } from '../../utils/distance';
import notificationService from '../../services/notificationService';


const ensureDriverUser = (req: IRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Not authorized', status: false });
    return false;
  }

  if (req.user.userType !== 'driver') {
    res.status(403).json({ message: 'Drivers only endpoint', status: false });
    return false;
  }

  return true;
};

export const getDriverStatus = async (req: IRequest, res: Response) => {
  const { driverId } = req.params;

  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const requesterId = req.user._id?.toString();
    const requestingAdmin = req.user.isAdmin;

    if (!requestingAdmin && requesterId !== driverId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const driver = await User.findById(driverId).select('-password');

    if (!driver || driver.userType !== 'driver') {
      return res.status(404).json({ message: 'Driver not found' });
    }

    if (!driver.location) {
      return res.status(404).json({ message: 'Driver location not found' });
    }
    res.status(200).json({
      data: {
        latitude: driver.location.coordinates[1],
        longitude: driver.location.coordinates[0],
        heading: driver.heading || 0, // Default to 0 if not set
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateLocation = async (req: IRequest, res: Response) => {
  if (!ensureDriverUser(req, res)) {
    return;
  }

  const { lat, lng, heading, rideId = null } = req.body;

  if (!lat || !lng) {
    return res.status(400).json({ message: 'Location coordinates are required' });
  }

  try {
    const driverId = req.user!._id;
    const driver = await User.findById(driverId);

    if (!driver || driver.userType !== 'driver') {
      return res.status(404).json({ message: 'Driver not found' });
    }

    driver.location = {
      type: 'Point',
      coordinates: [parseFloat(lng), parseFloat(lat)],
    };

    // Update heading separately if provided
    if (heading !== undefined && heading !== null) {
      driver.heading = parseFloat(heading);
    }

    const io = getIO();
    if (io && rideId) {
      const roomName = `ride_${rideId}`;
      io.to(roomName).emit('update_driver_location', {
        driverId,
        latitude: driver.location.coordinates[1],
        longitude: driver.location.coordinates[0],
        heading: driver.heading || 0,
      });
    }


    await driver.save();


    res.status(200).json({ message: 'Location updated successfully' });

  } catch (error) {
    console.log("error", error)
    res.status(500).json({ message: 'Server error' });
  }
};


export const updateLocationBackground = async (req: IRequest, res: Response) => {
  if (!ensureDriverUser(req, res)) {
    return;
  }

  const { location, rideId = null } = req.body;
  const { coords } = location;
  const { latitude: lat, longitude: lng, heading } = coords;


  if (!lat || !lng) {
    return res.status(400).json({ message: 'Location coordinates are required' });
  }

  try {
    const driverId = req.user!._id;
    const driver = await User.findById(driverId);

    if (!driver || driver.userType !== 'driver') {
      return res.status(404).json({ message: 'Driver not found' });
    }

    driver.location = {
      type: 'Point',
      coordinates: [parseFloat(lng), parseFloat(lat)],
    };

    // Update heading separately if provided
    if (heading !== undefined && heading !== null) {
      driver.heading = parseFloat(heading);
    }

    const io = getIO();
    if (io && rideId) {
      console.log("emit ride to customer", rideId)
      const roomName = `ride_${rideId}`;
      io.to(roomName).emit('update_driver_location', {
        driverId,
        latitude: driver.location.coordinates[1],
        longitude: driver.location.coordinates[0],
        heading: driver.heading || 0,
      });

      // Check proximity to pickup location and send notifications
      try {
        const ride = await Ride.findById(rideId).populate('rider', 'fullName');

        if (ride && ride.status === 'accepted' && ride.pickupLocation?.coordinates) {
          const pickupLat = ride.pickupLocation.coordinates[1];
          const pickupLng = ride.pickupLocation.coordinates[0];
          const driverLat = parseFloat(lat);
          const driverLng = parseFloat(lng);

          // Calculate distance to pickup location in meters
          const distanceMeters = calculateDistanceInMeters(
            driverLat,
            driverLng,
            pickupLat,
            pickupLng
          );

          const distanceKm = distanceMeters / 1000;
          const estimatedMinutes = estimateTimeToReach(distanceKm);

          console.log(`📍 Driver distance to pickup: ${distanceMeters.toFixed(0)}m (~${estimatedMinutes} min)`);

          // Initialize proximity notifications if not set
          if (!ride.proximityNotifications) {
            ride.proximityNotifications = {
              fiveMinutesAway: false,
              twoMinutesAway: false,
              arrived: false
            };
          }

          const riderId = (ride.rider as any)._id?.toString() || ride.rider.toString();
          const riderName = (ride.rider as any).fullName || 'Rider';

          // Send "Driver has arrived" notification (within 50m)
          if (distanceMeters <= 50 && !ride.proximityNotifications.arrived) {
            await notificationService.sendToUser(
              riderId,
              {
                title: '🎯 Driver Has Arrived!',
                body: `Your driver is here at the pickup location. Please come out.`,
                data: {
                  type: 'driver_arrived',
                  rideId: rideId,
                  distance: distanceMeters.toFixed(0),
                }
              },
              { channelId: 'ride_updates', priority: 'high' }
            );
            ride.proximityNotifications.arrived = true;
            console.log(`✅ Sent "Driver arrived" notification to rider`);
          }
          // Send "2 minutes away" notification (between 50m and 500m)
          else if (distanceMeters > 50 && distanceMeters <= 500 && !ride.proximityNotifications.twoMinutesAway) {
            await notificationService.sendToUser(
              riderId,
              {
                title: '⏰ Driver is 2 Minutes Away!',
                body: `Your driver will arrive shortly. Please get ready.`,
                data: {
                  type: 'driver_nearby',
                  rideId: rideId,
                  distance: distanceMeters.toFixed(0),
                  estimatedMinutes: '2',
                }
              },
              { channelId: 'ride_updates', priority: 'high' }
            );
            ride.proximityNotifications.twoMinutesAway = true;
            console.log(`✅ Sent "2 minutes away" notification to rider`);
          }
          // Send "5 minutes away" notification (between 500m and 2km)
          else if (distanceMeters > 500 && distanceMeters <= 2000 && !ride.proximityNotifications.fiveMinutesAway) {
            await notificationService.sendToUser(
              riderId,
              {
                title: '🚗 Driver is 5 Minutes Away!',
                body: `Your driver is on the way and will arrive in about 5 minutes.`,
                data: {
                  type: 'driver_approaching',
                  rideId: rideId,
                  distance: distanceMeters.toFixed(0),
                  estimatedMinutes: estimatedMinutes.toString(),
                }
              },
              { channelId: 'ride_updates', priority: 'high' }
            );
            ride.proximityNotifications.fiveMinutesAway = true;
            console.log(`✅ Sent "5 minutes away" notification to rider`);
          }

          // Save ride if any notification was sent
          if (ride.isModified('proximityNotifications')) {
            await ride.save();
          }
        }
      } catch (proximityError) {
        console.error('❌ Error sending proximity notification:', proximityError);
        // Don't fail the location update if notification fails
      }
    }


    await driver.save();


    res.status(200).json({ message: 'Location updated successfully' });

  } catch (error) {
    console.log("error", error)
    res.status(500).json({ message: 'Server error' });
  }
};
