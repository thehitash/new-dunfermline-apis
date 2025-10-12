import mongoose, { Document, Schema } from 'mongoose';

export interface IRide extends Document {
  rider: mongoose.Types.ObjectId;
  driver?: mongoose.Types.ObjectId;
  pickupLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  destinationLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  status: 'pending' | 'accepted' | 'ongoing' | 'completed' | 'cancelled';
  fare?: number;
}

const RideSchema: Schema = new Schema({
  rider: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  driver: { type: Schema.Types.ObjectId, ref: 'User' },
  pickupLocation: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    address: { type: String, required: true },
    place_id: { type: String, required: true },
    name: { type: String, required: true },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  destinationLocation: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    address: { type: String, required: true },
    place_id: { type: String, required: true },
    name: { type: String, required: true },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  status: { type: String, enum: ['pending', 'accepted', 'ongoing', 'completed', 'cancelled'], default: 'pending' },
  fare: { type: Number }
}, { timestamps: true });

RideSchema.index({ pickupLocation: '2dsphere', destinationLocation: '2dsphere' });

export default mongoose.model<IRide>('Ride', RideSchema); 