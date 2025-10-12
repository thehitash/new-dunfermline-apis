import { Response } from 'express';
import User from '../models/user';
import { IRequest } from '../middlewares/authMiddleware';
import { getIO } from '../../socket/socketInstance';


export const getDriverStatus = async (req: IRequest, res: Response) => {
  const { driverId } = req.params;

  try {
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
        heading: driver.location.coordinates[2],
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateLocation = async (req: IRequest, res: Response) => {
  const { driverId, lat, lng, heading, rideId = null } = req.body;

  if (!driverId || !lat || !lng) {
    return res.status(400).json({ message: 'Driver ID and location are required' });
  }

  try {
    const driver = await User.findById(driverId);

    if (!driver || driver.userType !== 'driver') {
      return res.status(404).json({ message: 'Driver not found' });
    }

    driver.location = {
      type: 'Point',
      coordinates: [parseFloat(lng), parseFloat(lat), parseFloat(heading)],
    };


    const io = getIO();
    if (io && rideId) {

      const roomName = `ride_${rideId}`;
      io.to(roomName).emit('update_driver_location', {
        driverId,
        latitude: driver.location.coordinates[1],
        longitude: driver.location.coordinates[0],
        heading: driver.location.coordinates[2],
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

  
  const { driverId, location, rideId = null } = req.body;
  const { coords } = location;
  const { latitude: lat, longitude: lng, heading } = coords;


  if (!driverId || !lat || !lng) {
    console.log("error++++")
    return res.status(400).json({ message: 'Driver ID and location are required' });
  }

  try {
    const driver = await User.findById(driverId);

    if (!driver || driver.userType !== 'driver') {
      return res.status(404).json({ message: 'Driver not found' });
    }

    driver.location = {
      type: 'Point',
      coordinates: [parseFloat(lng), parseFloat(lat), parseFloat(heading)],
    };


    const io = getIO();
    if (io && rideId) {

      console.log("emit ride to customer", rideId)
      const roomName = `ride_${rideId}`;
      io.to(roomName).emit('update_driver_location', {
        driverId,
        latitude: driver.location.coordinates[1],
        longitude: driver.location.coordinates[0],
        heading: driver.location.coordinates[2],
      });
    }


    await driver.save();


    res.status(200).json({ message: 'Location updated successfully' });

  } catch (error) {
    console.log("error", error)
    res.status(500).json({ message: 'Server error' });
  }
};