import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
  user: {
    _id: mongoose.Types.ObjectId;
    name: string;
    avatar: string;
  };
  ride: mongoose.Types.ObjectId;
}

const MessageSchema: Schema = new Schema({
  text: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true },
}, { timestamps: true });

export default mongoose.model<IMessage>('Message', MessageSchema); 