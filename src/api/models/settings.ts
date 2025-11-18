import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  maintenanceStartTime?: Date;
  maintenanceEndTime?: Date;
  affectedServices: string[];
  lastUpdatedBy: mongoose.Types.ObjectId;
  lastUpdatedAt: Date;
}

const SettingsSchema: Schema = new Schema({
  maintenanceMode: {
    type: Boolean,
    default: false,
    required: true
  },
  maintenanceMessage: {
    type: String,
    default: 'The app is currently under maintenance. Please try again later.',
    maxlength: 500
  },
  maintenanceStartTime: {
    type: Date
  },
  maintenanceEndTime: {
    type: Date
  },
  affectedServices: {
    type: [String],
    enum: ['bookings', 'payments', 'notifications', 'all'],
    default: ['all']
  },
  lastUpdatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model<ISettings>('Settings', SettingsSchema);
