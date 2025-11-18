import { Response } from 'express';
import Message from '../models/message';
import Ride from '../models/ride';
import { IRequest } from '../middlewares/authMiddleware';

/**
 * Fetch chat messages for a ride ensuring the requester is either the rider,
 * assigned driver, or an admin.
 */
export const getMessages = async (req: IRequest, res: Response) => {
  const { rideId } = req.query;

  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  if (!rideId || typeof rideId !== 'string') {
    return res.status(400).json({ message: 'rideId is required' });
  }

  try {
    const ride = await Ride.findById(rideId).select('rider driver');

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    const requesterId = req.user._id?.toString();
    const isParticipant =
      requesterId &&
      ((ride.rider as any)?.toString() === requesterId ||
        (ride.driver as any)?.toString() === requesterId);

    if (!isParticipant && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const messages = await Message.find({ ride: rideId })
      .populate({
        path: 'user',
        select: 'fullName profileImage',
        transform: (doc) => ({
          _id: doc._id,
          name: doc.fullName,
          avatar: doc.profileImage
        })
      })
      .sort({ createdAt: 1 });

    res.json({ messages });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
