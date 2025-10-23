import { Response } from 'express';
import Ride from '../models/ride';
import User from '../models/user';
import { IRequest } from '../middlewares/authMiddleware';
import { getIO } from '../../socket/socketInstance';
import notificationService from '../../services/notificationService';

export const requestRide = async (req: IRequest, res: Response) => {
  const { pickup, destination, vehicleId, estimatedFare, scheduledTime, bookingMethod } = req.body;

  console.log('=== REQUEST RIDE (Backend) ===');
  console.log('📍 Pickup:', pickup?.name);
  console.log('📍 Destination:', destination?.name);
  console.log('🚗 Vehicle ID:', vehicleId);
  console.log('💷 Estimated Fare:', estimatedFare);
  console.log('📅 Scheduled Time:', scheduledTime);
  console.log('📱 Booking Method:', bookingMethod);

  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const riderId = req.user._id;


  if (!pickup || !destination) {
    return res.status(400).json({ message: 'Pickup and destination locations are required' });
  }

  // Validate scheduled time if provided
  if (scheduledTime) {
    const scheduledDate = new Date(scheduledTime);
    const now = new Date();
    const minimumTime = new Date(now.getTime() + 30 * 60000); // 30 minutes from now

    if (scheduledDate < minimumTime) {
      return res.status(400).json({ message: 'Scheduled time must be at least 30 minutes from now' });
    }

    const maxTime = new Date(now.getTime() + 7 * 24 * 60 * 60000); // 7 days
    if (scheduledDate > maxTime) {
      return res.status(400).json({ message: 'Scheduled time cannot be more than 7 days in the future' });
    }
  }

  try {
    const rideData: any = {
      rider: riderId,
      pickupLocation: {
        type: 'Point',
        coordinates: [pickup.longitude, pickup.latitude],
        address: pickup.description,
        place_id: pickup.place_id,
        name: pickup.name,
      },
      destinationLocation: {
        type: 'Point',
        coordinates: [destination.longitude, destination.latitude],
        address: destination.description,
        place_id: destination.place_id,
        name: destination.name,
      },
    };

    // Add optional fields if provided
    if (vehicleId) {
      rideData.vehicle = vehicleId;
    }
    if (estimatedFare) {
      rideData.estimatedFare = estimatedFare;
    }
    if (scheduledTime) {
      rideData.scheduledTime = new Date(scheduledTime);
      rideData.isScheduled = true;
    }
    if (bookingMethod) {
      rideData.bookingMethod = bookingMethod;
    }

    const ride = await Ride.create(rideData);
    console.log('✅ Ride created successfully:', ride._id);

    // Populate rider info
    await ride.populate('rider', 'fullName phoneNumber');
    await ride.populate('vehicle', 'name capacity type');

    // For app bookings (not WhatsApp), drivers will be notified AFTER payment completes
    // For WhatsApp bookings, notify drivers immediately
    if (bookingMethod === 'whatsapp') {
      console.log('📱 WhatsApp booking - Notifying drivers immediately...');

      // Find all drivers
      const drivers = await User.find({
        userType: 'driver',
      });

      console.log(`📍 Found ${drivers.length} drivers to notify`);

      // Send real-time socket notification
      const io = getIO();
      if (io) {
        io.emit('new_ride_request', ride);
      }

      // Send push notification to all drivers
      const driverIds = drivers.map(driver => (driver._id as any).toString());

      const notificationPayload = {
        title: '🚖 New Ride Request! (WhatsApp)',
        body: `Pickup: ${pickup.name || pickup.description}\nDestination: ${destination.name || destination.description}`,
        data: {
          type: 'new_ride_request',
          rideId: (ride._id as any).toString(),
          pickupLocation: pickup.name || pickup.description,
          destinationLocation: destination.name || destination.description,
          estimatedFare: estimatedFare?.toString() || '',
        }
      };

      console.log('📲 Sending push notification to drivers...');
      const result = await notificationService.sendToMultipleUsers(
        driverIds,
        notificationPayload,
        { channelId: 'ride_updates', priority: 'high' }
      );

      console.log(`✅ Push notification sent - Success: ${result.successCount}, Failed: ${result.failureCount}`);
    } else {
      console.log('💳 App booking - Drivers will be notified after payment completes');
    }

    res.status(201).json({ data: ride, status: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const acceptRejectRide = async (req: IRequest, res: Response) => {
  const { rideId, status } = req.body;

  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const driverId = req.user._id;



  try {
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    // Check if the ride is already assigned to a driver
    if (ride.driver && ride.driver.toString() !== (driverId as any).toString()) {
      return res.status(400).json({ message: 'Ride already accepted by another driver' });
    }

    // Validate status transitions
    const validStatuses = ['pending', 'accepted', 'ongoing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Check if driver can change status based on current status
    if (ride.status === 'pending' && status !== 'accepted') {
      return res.status(400).json({ message: 'Can only accept pending rides' });
    }

    if (ride.status === 'accepted' && !['ongoing', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Accepted rides can only be changed to ongoing or cancelled' });
    }

    if (ride.status === 'ongoing' && status !== 'completed') {
      return res.status(400).json({ message: 'Ongoing rides can only be completed' });
    }

    if (ride.status === 'completed' || ride.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot change status of completed or cancelled rides' });
    }

    // Update ride
    ride.driver = driverId as any;
    ride.status = status;

    await ride.save();

    // Populate rider and driver info for notifications
    await ride.populate('rider', 'fullName phoneNumber');
    await ride.populate('driver', 'fullName phoneNumber carDetails');
    await ride.populate('vehicle', 'name capacity type');

    // Send real-time socket notification
    const io = getIO();
    if (io) {
      const roomName = `ride_${rideId}`;
      io.to(roomName).emit('ride_update', { rideId });
    }

    // Send push notifications based on status change
    if (status === 'accepted') {
      // Notify rider that driver accepted the ride
      const driverName = (ride.driver as any).fullName || 'A driver';
      const carDetails = (ride.driver as any).carDetails;
      const carInfo = carDetails
        ? `${carDetails.carName} ${carDetails.carColor} (${carDetails.carNumber})`
        : 'their vehicle';

      const notificationPayload = {
        title: '✅ Ride Accepted!',
        body: `${driverName} accepted your ride request. ${carInfo} is on the way!`,
        data: {
          type: 'ride_accepted',
          rideId: (ride._id as any).toString(),
          driverName,
          status: 'accepted',
        }
      };

      console.log('📲 Notifying rider - Ride accepted by driver');
      await notificationService.sendToUser(
        (ride.rider as any)._id.toString(),
        notificationPayload,
        { channelId: 'ride_updates', priority: 'high' }
      );
    }
    else if (status === 'ongoing') {
      // Notify rider that ride has started
      const driverName = (ride.driver as any).fullName || 'Your driver';

      const notificationPayload = {
        title: '🚗 Ride Started!',
        body: `${driverName} has started your ride. Enjoy your journey!`,
        data: {
          type: 'ride_started',
          rideId: (ride._id as any).toString(),
          status: 'ongoing',
        }
      };

      console.log('📲 Notifying rider - Ride started');
      await notificationService.sendToUser(
        (ride.rider as any)._id.toString(),
        notificationPayload,
        { channelId: 'ride_updates', priority: 'high' }
      );
    }
    else if (status === 'completed') {
      // Notify both rider and driver that ride is completed
      const fareAmount = (ride as any).finalFare || ride.estimatedFare;
      const fareText = fareAmount ? `£${fareAmount.toFixed(2)}` : '';

      // Notify rider
      const riderNotification = {
        title: '🎉 Ride Completed!',
        body: `Your ride has been completed. ${fareText ? `Total fare: ${fareText}` : 'Thank you for riding with us!'}`,
        data: {
          type: 'ride_completed',
          rideId: (ride._id as any).toString(),
          status: 'completed',
          fare: fareAmount?.toString() || '',
        }
      };

      console.log('📲 Notifying rider - Ride completed');
      await notificationService.sendToUser(
        (ride.rider as any)._id.toString(),
        riderNotification,
        { channelId: 'ride_updates', priority: 'high' }
      );

      // Notify driver
      const driverNotification = {
        title: '✅ Ride Completed!',
        body: `Ride completed successfully. ${fareText ? `Fare: ${fareText}` : 'Great job!'}`,
        data: {
          type: 'ride_completed',
          rideId: (ride._id as any).toString(),
          status: 'completed',
          fare: fareAmount?.toString() || '',
        }
      };

      console.log('📲 Notifying driver - Ride completed');
      await notificationService.sendToUser(
        (driverId as any).toString(),
        driverNotification,
        { channelId: 'ride_updates', priority: 'high' }
      );
    }
    else if (status === 'cancelled') {
      // Notify rider that ride was cancelled
      const notificationPayload = {
        title: '❌ Ride Cancelled',
        body: 'Your ride has been cancelled. You can request a new ride anytime.',
        data: {
          type: 'ride_cancelled',
          rideId: (ride._id as any).toString(),
          status: 'cancelled',
        }
      };

      console.log('📲 Notifying rider - Ride cancelled by driver');
      await notificationService.sendToUser(
        (ride.rider as any)._id.toString(),
        notificationPayload,
        { channelId: 'ride_updates', priority: 'high' }
      );
    }

    res.status(200).json(ride);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const cancelRide = async (req: IRequest, res: Response) => {
  const { rideId } = req.params;

  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const riderId = req.user._id;

  try {
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (ride.rider.toString() !== (riderId as any).toString()) {
      return res.status(403).json({ message: 'You are not authorized to cancel this ride' });
    }

    if (ride.status !== 'pending' && ride.status !== 'accepted') {
      return res.status(400).json({ message: 'Ride cannot be cancelled at this stage' });
    }

    const previousStatus = ride.status;
    ride.status = 'cancelled';
    await ride.save();

    // Populate rider info for notification
    await ride.populate('rider', 'fullName phoneNumber');

    // Send real-time socket notification
    const io = getIO();
    if (io) {
      const roomName = `ride_${rideId}`;
      io.to(roomName).emit('ride_update', { rideId });
    }

    // If ride was accepted, notify the driver about cancellation
    if (previousStatus === 'accepted' && ride.driver) {
      await ride.populate('driver', 'fullName phoneNumber');

      const riderName = (ride.rider as any).fullName || 'The rider';
      const notificationPayload = {
        title: '❌ Ride Cancelled',
        body: `${riderName} has cancelled the ride.`,
        data: {
          type: 'ride_cancelled',
          rideId: (ride._id as any).toString(),
          status: 'cancelled',
          cancelledBy: 'rider',
        }
      };

      console.log('📲 Notifying driver - Ride cancelled by rider');
      await notificationService.sendToUser(
        (ride.driver as any)._id.toString(),
        notificationPayload,
        { channelId: 'ride_updates', priority: 'high' }
      );
    }

    res.status(200).json({ message: 'Ride cancelled successfully', status: true });

  } catch (error) {
    console.error("Error cancelling ride:", error);
    res.status(500).json({ message: 'Server error', status: false });
  }
};

export const allDriverRides = async (req: IRequest, res: Response) => {
  if (!req.user) {
    console.error('❌ User not authenticated');
    return res.status(401).json({ message: 'Not authorized', status: false });
  }

  try {
    console.log('🔍 Fetching driver rides for:', req.user._id);

    const rides = await Ride.find({ driver: req.user._id })
      .populate('rider', 'fullName phoneNumber')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${rides.length} driver rides`);

    res.status(200).json({ data: rides, status: true });
  } catch (error) {
    console.error('❌ Error fetching driver rides:', error);
    res.status(500).json({ message: 'Server error', status: false });
  }
}

export const allRiderRides = async (req: IRequest, res: Response) => {
  const { type, userType } = req.query;

  console.log('🔍 Fetching rides for user:', {
    userId: req.user?._id,
    type,
    userType,
    query: req.query
  });

  if (!req.user) {
    console.error('❌ User not authenticated');
    return res.status(401).json({ message: 'Not authorized', status: false });
  }

  let statusFilter: string[] = [];
  if (type === 'current') {
    statusFilter = ['pending', 'accepted', 'ongoing'];
  } else if (type === 'past') {
    statusFilter = ['completed', 'cancelled'];
  } else {
    // If no type specified, return all rides
    statusFilter = ['pending', 'accepted', 'ongoing', 'completed', 'cancelled'];
  }

  try {
    const userField = userType === 'driver' ? 'driver' : 'rider';
    const query: any = {
      [userField]: req.user._id,
      status: { $in: statusFilter }
    };

    // Exclude WhatsApp bookings from current rides (they appear only in past)
    if (type === 'current') {
      query.bookingMethod = { $ne: 'whatsapp' };
      console.log('🚫 Filtering out WhatsApp bookings from current rides');
    }

    console.log('📋 Query:', JSON.stringify(query));

    const rides = await Ride.find(query)
      .populate('driver', 'fullName profileImage rating carDetails')
      .populate('rider', 'fullName phoneNumber')
      .populate('vehicle', 'name capacity type')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${rides.length} rides for ${userField}`);

    res.status(200).json({ data: rides, status: true });
  } catch (error) {
    console.error('❌ Error fetching rides:', error);
    res.status(500).json({ message: 'Server error', status: false });
  }
}

export const pendingRides = async (req: IRequest, res: Response) => {
  try {
    console.log('🔍 Fetching pending rides for drivers');

    // Filter out WhatsApp bookings (8-seater rides)
    // Only show app-based bookings or rides without bookingMethod specified
    const rides = await Ride.find({
      status: 'pending',
      bookingMethod: { $ne: 'whatsapp' } // Exclude WhatsApp bookings
    })
      .populate('rider', 'fullName phoneNumber')
      .populate('vehicle', 'name capacity type')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${rides.length} pending rides (WhatsApp bookings excluded)`);

    res.status(200).json({ data: rides, status: true });
  } catch (error) {
    console.error('❌ Error fetching pending rides:', error);
    res.status(500).json({ message: 'Server error', status: false });
  }
}

export const getRideById = async (req: IRequest, res: Response) => {
  const { rideId } = req.params;

  console.log('🔍 Fetching ride by ID:', rideId);

  try {
    const ride = await Ride.findById(rideId)
      .populate('rider', 'fullName phoneNumber')
      .populate('driver', 'fullName profileImage rating carDetails');

    if (!ride) {
      console.warn('⚠️  Ride not found:', rideId);
      return res.status(404).json({ message: 'Ride not found', status: false });
    }

    console.log('✅ Ride found:', ride._id);

    res.status(200).json({ data: ride, status: true });
  } catch (error) {
    console.error('❌ Error fetching ride:', error);
    res.status(500).json({ message: 'Server error', status: false });
  }
}

/**
 * Get all rides (admin only) with pagination
 * @route GET /api/ride/all-rides?page=1&limit=10
 * @access Private/Admin
 */
export const getAllRides = async (req: IRequest, res: Response) => {
  try {
    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    console.log(`🔍 Fetching all rides - Page: ${page}, Limit: ${limit}`);

    // Get total count for pagination metadata
    const totalRides = await Ride.countDocuments();

    // Fetch rides with pagination
    const rides = await Ride.find()
      .populate('rider', 'fullName phoneNumber email')
      .populate('driver', 'fullName phoneNumber profileImage rating carDetails')
      .populate('vehicle', 'name capacity type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRides / limit);

    console.log(`✅ Found ${rides.length} rides (Total: ${totalRides})`);

    res.status(200).json({
      status: true,
      data: rides,
      pagination: {
        currentPage: page,
        totalPages,
        totalRides,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('❌ Error fetching all rides:', error);
    res.status(500).json({ message: 'Server error', status: false });
  }
};