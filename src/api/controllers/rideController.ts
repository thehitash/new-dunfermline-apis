import { Response } from 'express';
import Ride from '../models/ride';
import User from '../models/user';
import { IRequest } from '../middlewares/authMiddleware';
import { getIO } from '../../socket/socketInstance';

export const requestRide = async (req: IRequest, res: Response) => {
  const { pickup, destination } = req.body;
  const riderId = req.user._id;


  if (!pickup || !destination) {
    return res.status(400).json({ message: 'Pickup and destination locations are required' });
  }

  try {
    const ride = await Ride.create({
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
    });


    // Find nearby drivers
    // const drivers = await User.find({
    //   location: {
    //     $near: {
    //       $geometry: {
    //         type: 'Point',
    //         coordinates: [pickup.longitude, pickup.latitude],
    //       },
    //       $maxDistance: 5000, // 5km
    //     },
    //   },
    //   userType: 'driver',
    // });

    const drivers = await User.find({
      userType: 'driver',
    });

    console.log(`Found ${drivers.length} nearby drivers.`);


    const io = getIO();
    if (io) {
      io.emit('new_ride_request', ride);
    }

    // Emit ride request to nearby drivers
    // drivers.forEach(driver => {
    //   console.log(`Emitting rideRequest to driver: ${driver._id}`);
    //   const io = getIO();
    //   if (io) {
    //     io.to(driver._id as string).emit('rideRequest', ride);
    //   }
    // });

    res.status(201).json({ data: ride, status: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const acceptRejectRide = async (req: IRequest, res: Response) => {
  const { rideId, status } = req.body;
  const driverId = req.user._id;



  try {
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    // Check if the ride is already assigned to a driver
    if (ride.driver && ride.driver.toString() !== driverId.toString()) {
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
    ride.driver = driverId;
    ride.status = status;



    await ride.save();

    const io = getIO();
    if (io) {

      const roomName = `ride_${rideId}`;

      io.to(roomName).emit('ride_update', { rideId });
    }

    res.status(200).json(ride);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const cancelRide = async (req: IRequest, res: Response) => {
  const { rideId } = req.params;
  const riderId = req.user!._id;

  try {
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    if (ride.rider.toString() !== riderId.toString()) {
      return res.status(403).json({ message: 'You are not authorized to cancel this ride' });
    }

    if (ride.status !== 'pending' && ride.status !== 'accepted') {
      return res.status(400).json({ message: 'Ride cannot be cancelled at this stage' });
    }

    ride.status = 'cancelled';
    await ride.save();

    res.status(200).json({ message: 'Ride cancelled successfully', status: true });

  } catch (error) {
    console.error("Error cancelling ride:", error);
    res.status(500).json({ message: 'Server error', status: false });
  }
};

export const allDriverRides = async (req: IRequest, res: Response) => {

  try {
    const rides = await Ride.find({ driver: req.user._id });
    res.status(200).json({ data: rides });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export const allRiderRides = async (req: IRequest, res: Response) => {
  const { type, userType } = req.query;

  let statusFilter: string[] = [];
  if (type === 'current') {
    statusFilter = ['pending', 'accepted', 'ongoing'];
  } else if (type === 'past') {
    statusFilter = ['completed', 'cancelled'];
  }

  try {
    const rides = await Ride.find({ [userType === 'driver' ? 'driver' : 'rider']: req.user._id, status: { $in: statusFilter } })
      .populate('driver', 'fullName profileImage rating carDetails').populate('rider', 'fullName phoneNumber')
      .sort({ createdAt: -1 });
    res.status(200).json({ data: rides });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export const pendingRides = async (req: IRequest, res: Response) => {
  try {
    const rides = await Ride.find({ status: 'pending' }).populate('rider', 'fullName phoneNumber').sort({ createdAt: -1 });
    res.status(200).json({ data: rides });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export const getRideById = async (req: IRequest, res: Response) => {
  const { rideId } = req.params;
  try {
    const ride = await Ride.findById(rideId).populate('rider', 'fullName phoneNumber').populate('driver', 'fullName profileImage rating carDetails');
    res.status(200).json({ data: ride });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}