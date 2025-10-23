import mongoose, { Document, Schema } from 'mongoose';

export interface IOTP extends Document {
  phoneNumber: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
}

const OTPSchema: Schema = new Schema({
  phoneNumber: {
    type: String,
    required: true,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // TTL index - MongoDB will automatically delete expired documents
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for faster lookups
OTPSchema.index({ phoneNumber: 1, expiresAt: 1 });

export default mongoose.model<IOTP>('OTP', OTPSchema);
