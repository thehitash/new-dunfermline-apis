import mongoose, { Document, Schema } from 'mongoose';

export interface IRide extends Document {
  rider: mongoose.Types.ObjectId;
  driver?: mongoose.Types.ObjectId;
  vehicle?: mongoose.Types.ObjectId;
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
  estimatedFare?: number;
  scheduledTime?: Date;
  isScheduled?: boolean;
  paymentStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  paymentMethod?: 'revolut' | 'card' | 'cash' | 'wallet';
  paymentId?: string;
  paymentUrl?: string;
  revolutOrderId?: string;
  bookingMethod?: 'app' | 'whatsapp';
  proximityNotifications?: {
    fiveMinutesAway?: boolean;
    twoMinutesAway?: boolean;
    arrived?: boolean;
  };
}

const RideSchema: Schema = new Schema({
  rider: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  driver: { type: Schema.Types.ObjectId, ref: 'User' },
  vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
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
  fare: { type: Number },
  estimatedFare: { type: Number },
  scheduledTime: { type: Date },
  isScheduled: { type: Boolean, default: false },
  paymentStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'refunded'], default: 'pending' },
  paymentMethod: { type: String, enum: ['revolut', 'card', 'cash', 'wallet'] },
  paymentId: { type: String },
  paymentUrl: { type: String },
  revolutOrderId: { type: String },
  bookingMethod: { type: String, enum: ['app', 'whatsapp'], default: 'app' },
  proximityNotifications: {
    type: {
      fiveMinutesAway: { type: Boolean, default: false },
      twoMinutesAway: { type: Boolean, default: false },
      arrived: { type: Boolean, default: false }
    },
    default: {}
  }
}, { timestamps: true });

RideSchema.index({ pickupLocation: '2dsphere', destinationLocation: '2dsphere' });

export default mongoose.model<IRide>('Ride', RideSchema); 