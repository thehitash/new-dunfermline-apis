import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  fullName: string;
  email: string;
  phoneNumber: string;
  password?: string;
  profileImage?: string;
  userType: 'rider' | 'driver';
  isAdmin?: boolean; // Admin flag for administrative access
  fcmToken?: string; // Firebase Cloud Messaging token for push notifications
  fcmTokens?: string[]; // Support multiple devices
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  heading?: number; // Compass direction (0-360 degrees) for drivers
  carDetails?: {
    carName: string;
    carNumber: string;
    carModel: string;
    carColor: string;
  };
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
  fullName: { type: String, required: true, minlength: 2, maxlength: 100 },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        // Standard email validation regex
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: (props: any) => `${props.value} is not a valid email address!`
    }
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v: string) {
        // UK phone number validation
        // Formats supported:
        // - +447XXXXXXXXX (UK mobile with +44)
        // - 07XXXXXXXXX (UK mobile without country code)
        // - +441XXXXXXXXX (UK landline with +44)
        // - 01XXXXXXXXX (UK landline without country code)
        // Total: 10-13 digits
        return /^(\+44|0)[1-9]\d{8,10}$/.test(v);
      },
      message: (props: any) => `${props.value} is not a valid UK phone number! Use format: 07XXXXXXXXX or +447XXXXXXXXX`
    }
  },
  password: {
    type: String,
    required: false, // Optional for OTP-based login
    minlength: 8, // Minimum 8 characters for password
    validate: {
      validator: function(v: string) {
        // Skip validation if password is not provided (OTP login)
        if (!v) return true;

        // Password must contain:
        // - At least 8 characters
        // - At least one uppercase letter
        // - At least one lowercase letter
        // - At least one number
        // - At least one special character
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(v);
      },
      message: () => 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
    }
  },
  userType: { type: String, enum: ['rider', 'driver'], required: true },
  isAdmin: { type: Boolean, default: false }, // Admin flag for administrative access
  profileImage: { type: String, default: "https://www.clipartmax.com/png/small/117-1179462_user-icon-flat-user-icon-png-green" },
  fcmToken: { type: String }, // Single FCM token (latest device)
  fcmTokens: { type: [String], default: [] }, // Multiple FCM tokens for multiple devices
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0] // [longitude, latitude]
    }
  },
  heading: { type: Number, min: 0, max: 360 }, // Compass direction for drivers
  carDetails: {
    carName: { type: String },
    carNumber: { type: String },
    carModel: { type: String },
    carColor: { type: String },
  }
}, { timestamps: true });

UserSchema.index({ location: '2dsphere' });

UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return await bcrypt.compare(password, this.password);
};

export default mongoose.model<IUser>('User', UserSchema); 