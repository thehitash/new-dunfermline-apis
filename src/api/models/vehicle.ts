import mongoose, { Document, Schema } from 'mongoose';

export interface IVehicle extends Document {
  name: string;
  type: string;
  capacity: number;
  description?: string;
  baseFare: number; // Fixed fare for rides up to baseMileageLimit
  baseMileageLimit: number; // Miles included in base fare (e.g., 3 miles)
  pricePerMileAfterBase: number; // Price per mile after baseMileageLimit
  image?: string;
  features: string[];
  isActive: boolean;
}

const VehicleSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    required: true,
    enum: ['comfort', 'luxury', 'economy']
  },
  capacity: {
    type: Number,
    required: true,
    min: 1,
    max: 20
  },
  description: {
    type: String
  },
  baseFare: {
    type: Number,
    required: true,
    min: 0,
    comment: 'Fixed fare for rides up to baseMileageLimit'
  },
  baseMileageLimit: {
    type: Number,
    required: true,
    min: 0,
    comment: 'Miles included in base fare (e.g., 3 miles)'
  },
  pricePerMileAfterBase: {
    type: Number,
    required: true,
    min: 0,
    comment: 'Price per mile after baseMileageLimit'
  },
  image: {
    type: String
  },
  features: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

export default mongoose.model<IVehicle>('Vehicle', VehicleSchema);
