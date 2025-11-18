import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  ride: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  paymentMethod: 'revolut' | 'card' | 'cash' | 'wallet';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  revolutOrderId?: string;
  revolutPaymentUrl?: string;
  transactionId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  completedAt?: Date;
}

const PaymentSchema: Schema = new Schema({
  ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'GBP', required: true },
  paymentMethod: {
    type: String,
    enum: ['revolut', 'card', 'cash', 'wallet'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending',
    required: true
  },
  revolutOrderId: { type: String },
  revolutPaymentUrl: { type: String },
  transactionId: { type: String },
  errorMessage: { type: String },
  metadata: { type: Schema.Types.Mixed },
  completedAt: { type: Date }
}, { timestamps: true });

// Indexes for efficient queries
PaymentSchema.index({ ride: 1 });
PaymentSchema.index({ user: 1 });
PaymentSchema.index({ revolutOrderId: 1 });
PaymentSchema.index({ status: 1 });

export default mongoose.model<IPayment>('Payment', PaymentSchema);
