import { Response } from 'express';
import Message from '../models/message';
import { IRequest } from '../middlewares/authMiddleware';

// Get chat messages between two users (optionally by ride)
export const getMessages = async (req: IRequest, res: Response) => {
  const {rideId } = req.query;

  try {
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
    res.status(500).json({ message: 'Server error' });
  }
};

