import { Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import Payment, { IPayment } from '../models/payment';
import Ride, { IRide } from '../models/ride';
import User from '../models/user';
import notificationService from '../../services/notificationService';
import { getIO } from '../../socket/socketInstance';
import { IRequest } from '../middlewares/authMiddleware';

// Revolut API configuration
// Using your existing environment variables
const REVOLUT_API_URL = process.env.REVOLUT_MERCHANT_BASE_URL || 'https://merchant.revolut.com';
const REVOLUT_API_KEY = process.env.REVOLUT_MERCHANT_SECRET || '';
const REVOLUT_API_VERSION = process.env.REVOLUT_API_VERSION || '2024-09-01';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';
const REVOLUT_WEBHOOK_SECRET = process.env.REVOLUT_WEBHOOK_SECRET || '';

type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded';

const mapRevolutStateToStatus = (state?: string): PaymentStatus => {
  switch (state) {
    case 'COMPLETED':
    case 'CAPTURED':
      return 'completed';
    case 'FAILED':
    case 'CANCELLED':
      return 'failed';
    case 'PENDING':
    case 'PROCESSING':
    default:
      return 'processing';
  }
};

const verifyWebhookSignature = (payload: any, signature?: string): boolean => {
  if (!REVOLUT_WEBHOOK_SECRET) {
    return true;
  }

  if (!signature) {
    return false;
  }

  try {
    const payloadString =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expected = crypto
      .createHmac('sha256', REVOLUT_WEBHOOK_SECRET)
      .update(payloadString)
      .digest('hex');

    if (expected.length !== signature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch (error) {
    console.error('Error validating webhook signature:', error);
    return false;
  }
};

const notifyDriversAboutRide = async (ride: IRide) => {
  const drivers = await User.find({ userType: 'driver' });
  if (!drivers.length) {
    return;
  }

  const driverIds = drivers.map((driver) => (driver._id as any).toString());
  const pickupName =
    (ride.pickupLocation as any)?.name ||
    (ride.pickupLocation as any)?.address ||
    'Pickup location';
  const destName =
    (ride.destinationLocation as any)?.name ||
    (ride.destinationLocation as any)?.address ||
    'Destination';

  const io = getIO();
  if (io) {
    io.emit('new_ride_request', ride);
  }

  await notificationService.sendToMultipleUsers(
    driverIds,
    {
      title: '🚖 New Ride Request!',
      body: `Pickup: ${pickupName}\nDestination: ${destName}`,
      data: {
        type: 'new_ride_request',
        rideId: (ride._id as any).toString(),
        pickupLocation: pickupName,
        destinationLocation: destName,
        estimatedFare: ride.estimatedFare?.toString() || '',
      },
    },
    { channelId: 'ride_updates', priority: 'high' }
  );
};

const persistRidePaymentStatus = async (
  ride: IRide | null,
  newStatus: PaymentStatus
) => {
  if (!ride) return;

  ride.paymentStatus = newStatus;
  await ride.save();

  if (newStatus === 'completed' && ride.bookingMethod === 'app') {
    await ride.populate('rider', 'fullName phoneNumber');
    await ride.populate('vehicle', 'name capacity type');
    await notifyDriversAboutRide(ride);
  }
};

const applyPaymentStatus = async (
  payment: IPayment,
  newStatus: PaymentStatus,
  metadata?: any
) => {
  payment.status = newStatus;
  if (metadata) {
    payment.metadata = metadata;
  }

  if (newStatus === 'completed') {
    payment.completedAt = new Date();
    payment.transactionId = metadata?.id || payment.transactionId;
    payment.errorMessage = undefined;
  } else if (newStatus === 'failed') {
    payment.errorMessage = metadata?.cancel_reason || 'Payment failed';
  }

  await payment.save();

  const ride = await Ride.findById(payment.ride);
  await persistRidePaymentStatus(ride as IRide, newStatus);
};

const syncPaymentStatusWithRevolut = async (payment: IPayment) => {
  if (!payment.revolutOrderId) {
    return null;
  }

  const revolutResponse = await axios.get(
    `${REVOLUT_API_URL}/api/orders/${payment.revolutOrderId}`,
    {
      headers: {
        Authorization: `Bearer ${REVOLUT_API_KEY}`,
        'Content-Type': 'application/json',
        'Revolut-Api-Version': REVOLUT_API_VERSION,
      },
    }
  );

  const revolutOrder = revolutResponse.data;
  const newStatus = mapRevolutStateToStatus(revolutOrder.state);
  await applyPaymentStatus(payment, newStatus, revolutOrder);

  return {
    status: newStatus,
    revolutStatus: revolutOrder.state,
  };
};

/**
 * Initiate payment with Revolut
 * Creates a payment order and returns the payment URL for webview
 */
export const initiatePayment = async (req: IRequest, res: Response) => {
  try {
    const { rideId, amount: clientAmount, currency = 'GBP' } = req.body;
    const userId = req.user?._id;

    console.log('=== INITIATE PAYMENT (Backend) ===');
    console.log('🆔 User ID from token:', userId);
    console.log('🚕 Ride ID:', rideId);
    console.log('💷 Amount (client):', clientAmount);
    console.log('💵 Currency:', currency);

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: 'Unauthorized'
      });
    }

    // Validate input
    if (!rideId) {
      return res.status(400).json({
        status: false,
        message: 'Missing required fields: rideId'
      });
    }

    // Check if ride exists (don't populate to get raw ObjectId)
    const ride = await Ride.findById(rideId).select('+rider');
    if (!ride) {
      console.error('❌ Ride not found:', rideId);
      return res.status(404).json({
        status: false,
        message: 'Ride not found'
      });
    }

    console.log('✅ Ride found:', ride._id);
    console.log('👤 Ride rider (raw):', ride.rider);
    console.log('👤 Ride rider type:', typeof ride.rider);
    console.log('👤 Request user ID (raw):', userId);
    console.log('👤 Request user type:', typeof userId);

    // Extract ObjectId properly - handle both ObjectId and populated User objects
    const riderId: any = ride.rider;
    const riderIdString = riderId?._id ? riderId._id.toString() : riderId.toString();
    const userIdString = typeof userId === 'object' && (userId as any)?._id
      ? (userId as any)._id.toString()
      : userId.toString();

    console.log('🔍 Rider ID (string):', riderIdString);
    console.log('🔍 User ID (string):', userIdString);
    console.log('✔️  IDs match:', riderIdString === userIdString);

    // Check if user is the rider
    if (riderIdString !== userIdString) {
      console.error('❌ Authorization failed: User is not the rider');
      console.error('   Expected rider:', riderIdString);
      console.error('   Got user:', userIdString);
      return res.status(403).json({
        status: false,
        message: 'Not authorized to pay for this ride'
      });
    }

    console.log('✅ Authorization successful');

    const rideFare = ride.estimatedFare ?? ride.fare;
    if (rideFare === undefined || rideFare === null) {
      return res.status(400).json({
        status: false,
        message: 'Ride fare is not available yet. Please try again later.',
      });
    }

    const normalizedAmount = Number(rideFare.toFixed(2));
    const numericClientAmount =
      typeof clientAmount === 'number'
        ? clientAmount
        : parseFloat(clientAmount);

    if (
      Number.isFinite(numericClientAmount) &&
      Math.abs(numericClientAmount - normalizedAmount) > 0.5
    ) {
      console.warn(
        `⚠️  Client attempted to pay ${numericClientAmount} but expected amount is ${normalizedAmount}. Using server amount.`
      );
    }

    // Create payment record
    const payment = new Payment({
      ride: rideId,
      user: userId,
      amount: normalizedAmount,
      currency: currency,
      paymentMethod: 'revolut',
      status: 'pending'
    });

    await payment.save();

    // Create Revolut order
    try {
      const orderPayload = {
        amount: Math.round(normalizedAmount * 100), // Convert to cents
        currency: currency,
        merchant_order_ext_ref: String(payment._id),
        description: `Payment for ride #${rideId}`,
        customer_email: req.user?.email || 'customer@dunfermlinetaxiapp.com',
        customer_phone: req.user?.phoneNumber || undefined,
        settlement_currency: currency,
        // Add redirect URLs for payment completion
        redirect_urls: {
          success: `${BACKEND_URL}/api/payment/success?paymentId=${payment._id}&rideId=${rideId}`,
          failure: `${BACKEND_URL}/api/payment/failure?paymentId=${payment._id}&rideId=${rideId}`,
          cancel: `${BACKEND_URL}/api/payment/cancel?paymentId=${payment._id}&rideId=${rideId}`
        },
        metadata: {
          rideId: rideId,
          userId: String(userId),
          paymentId: String(payment._id),
          customerName: req.user?.fullName || 'Customer',
          appVersion: '1.0.0'
        }
      };

      console.log('📤 Sending order to Revolut:', JSON.stringify(orderPayload, null, 2));

      const revolutResponse = await axios.post(
        `${REVOLUT_API_URL}/api/orders`,
        orderPayload,
        {
          headers: {
            'Authorization': `Bearer ${REVOLUT_API_KEY}`,
            'Content-Type': 'application/json',
            'Revolut-Api-Version': REVOLUT_API_VERSION
          }
        }
      );

      console.log('📥 Revolut response status:', revolutResponse.status);
      console.log('📥 Revolut response data:', JSON.stringify(revolutResponse.data, null, 2));

      const { id: revolutOrderId, public_id, checkout_url } = revolutResponse.data;

      console.log('🔗 Revolut checkout URL received:', checkout_url);
      console.log('🔗 Checkout URL type:', typeof checkout_url);
      console.log('🔗 Checkout URL length:', checkout_url?.length);

      // Update payment with Revolut order details
      payment.revolutOrderId = revolutOrderId;
      payment.revolutPaymentUrl = checkout_url;
      payment.status = 'processing';
      await payment.save();

      // Update ride with payment info
      ride.paymentStatus = 'processing';
      ride.paymentMethod = 'revolut';
      ride.paymentId = String(payment._id);
      ride.paymentUrl = checkout_url;
      ride.revolutOrderId = revolutOrderId;
      await ride.save();

      console.log('');
      console.log('📤 ===== SENDING PAYMENT RESPONSE =====');
      console.log('📤 Payment ID:', payment._id);
      console.log('📤 Payment URL:', checkout_url);
      console.log('📤 Payment URL Type:', typeof checkout_url);
      console.log('📤 Response data:', {
        paymentId: payment._id,
        paymentUrl: checkout_url,
        revolutOrderId: revolutOrderId,
        publicId: public_id,
        amount: normalizedAmount,
        currency: currency
      });
      console.log('=======================================');
      console.log('');

      return res.status(200).json({
        status: true,
        message: 'Payment initiated successfully',
        data: {
          paymentId: payment._id,
          paymentUrl: checkout_url,
          revolutOrderId: revolutOrderId,
          publicId: public_id,
          amount: normalizedAmount,
          currency: currency
        }
      });

    } catch (revolutError: any) {
      console.error('');
      console.error('❌ ===== REVOLUT API ERROR =====');
      console.error('❌ Error Status:', revolutError.response?.status);
      console.error('❌ Error Headers:', JSON.stringify(revolutError.response?.headers, null, 2));
      console.error('❌ Error Data:', JSON.stringify(revolutError.response?.data, null, 2));
      console.error('❌ Error Message:', revolutError.message);
      console.error('❌ Full Error:', JSON.stringify(revolutError, Object.getOwnPropertyNames(revolutError), 2));
      console.error('================================');
      console.error('');

      const errorMessage = revolutError.response?.data?.message ||
                          revolutError.response?.data?.error ||
                          revolutError.message ||
                          'Failed to create Revolut order';

      payment.status = 'failed';
      payment.errorMessage = errorMessage;
      payment.metadata = {
        error: revolutError.response?.data,
        errorCode: revolutError.response?.data?.code,
        errorType: revolutError.response?.data?.type
      };
      await payment.save();

      return res.status(500).json({
        status: false,
        message: 'Failed to initiate payment with Revolut',
        error: revolutError.response?.data || revolutError.message,
        errorDetails: {
          code: revolutError.response?.data?.code,
          type: revolutError.response?.data?.type,
          message: errorMessage
        }
      });
    }

  } catch (error: any) {
    console.error('Error initiating payment:', error);
    return res.status(500).json({
      status: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Verify payment status with Revolut
 * Called after payment webview is closed or from webhook
 */
export const verifyPayment = async (req: IRequest, res: Response) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: 'Unauthorized'
      });
    }

    // Find payment
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        status: false,
        message: 'Payment not found'
      });
    }

    // Check if user owns this payment
    if (payment.user.toString() !== String(userId)) {
      return res.status(403).json({
        status: false,
        message: 'Not authorized to access this payment'
      });
    }

    const syncResult = await syncPaymentStatusWithRevolut(payment);

    return res.status(200).json({
      status: true,
      message: 'Payment status retrieved successfully',
      data: {
        paymentId: payment._id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        revolutStatus: syncResult?.revolutStatus || (payment.metadata as any)?.state
      }
    });

  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      status: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Handle Revolut webhook callbacks
 * This endpoint receives payment status updates from Revolut
 */
export const handleRevolutWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['revolut-signature'] as string | undefined;

    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(401).json({
        status: false,
        message: 'Invalid webhook signature'
      });
    }

    const webhookData = req.body;
    const { event, order } = webhookData;

    console.log('Revolut Webhook received:', event, order?.id);

    if (!order || !order.merchant_order_ext_ref) {
      return res.status(400).json({
        status: false,
        message: 'Invalid webhook data'
      });
    }

    // Find payment by merchant reference (payment ID)
    const payment = await Payment.findById(order.merchant_order_ext_ref);
    if (!payment) {
      console.error('Payment not found for webhook:', order.merchant_order_ext_ref);
      return res.status(404).json({
        status: false,
        message: 'Payment not found'
      });
    }

    const newStatus = mapRevolutStateToStatus(order.state);
    console.log(`📦 Applying webhook status ${newStatus} from event ${event}`);

    await applyPaymentStatus(payment, newStatus, order);

    // Send success response to Revolut
    return res.status(200).json({
      status: true,
      message: 'Webhook processed successfully'
    });

  } catch (error: any) {
    console.error('Error handling Revolut webhook:', error);
    return res.status(500).json({
      status: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Cancel payment
 */
export const cancelPayment = async (req: IRequest, res: Response) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: 'Unauthorized'
      });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        status: false,
        message: 'Payment not found'
      });
    }

    if (payment.user.toString() !== String(userId)) {
      return res.status(403).json({
        status: false,
        message: 'Not authorized to cancel this payment'
      });
    }

    if (payment.status === 'completed') {
      return res.status(400).json({
        status: false,
        message: 'Cannot cancel completed payment'
      });
    }

    payment.status = 'failed';
    payment.errorMessage = 'Cancelled by user';
    await payment.save();

    // Update ride payment status
    const ride = await Ride.findById(payment.ride);
    if (ride) {
      ride.paymentStatus = 'failed';
      await ride.save();
    }

    return res.status(200).json({
      status: true,
      message: 'Payment cancelled successfully'
    });

  } catch (error: any) {
    console.error('Error cancelling payment:', error);
    return res.status(500).json({
      status: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Handle successful payment redirect from Revolut
 */
export const handlePaymentSuccess = async (req: Request, res: Response) => {
  try {
    const { paymentId, rideId } = req.query;

    console.log('✅ Payment success redirect:', { paymentId, rideId });

    let payment = null;
    if (paymentId) {
      payment = await Payment.findById(paymentId);
      if (payment) {
        try {
          await syncPaymentStatusWithRevolut(payment);
        } catch (error) {
          console.error('Error syncing payment success status:', error);
        }
      }
    }

    // Render EJS template
    return res.render('revolut/payment-success', {
      orderId: paymentId,
      amount: payment?.amount ? `£${payment.amount}` : 'N/A',
      paymentId: paymentId,
      rideId: rideId
    });
  } catch (error: any) {
    console.error('Error handling payment success:', error);
    return res.status(500).send('Error processing payment');
  }
};

/**
 * Handle failed payment redirect from Revolut
 */
export const handlePaymentFailure = async (req: Request, res: Response) => {
  try {
    const { paymentId, rideId } = req.query;

    console.log('❌ Payment failure redirect:', { paymentId, rideId });

    let payment = null;
    if (paymentId) {
      payment = await Payment.findById(paymentId);
      if (payment) {
        try {
          await syncPaymentStatusWithRevolut(payment);
        } catch (error) {
          console.error('Error syncing failed payment:', error);
        }
      }
    }

    // Render EJS template
    return res.render('revolut/payment-error', {
      errorMessage: 'Payment was declined or failed',
      orderId: paymentId,
      amount: payment?.amount ? `£${payment.amount}` : 'N/A',
      paymentId: paymentId,
      rideId: rideId
    });
  } catch (error: any) {
    console.error('Error handling payment failure:', error);
    return res.status(500).send('Error processing payment failure');
  }
};

/**
 * Handle cancelled payment redirect from Revolut
 */
export const handlePaymentCancelled = async (req: Request, res: Response) => {
  try {
    const { paymentId, rideId } = req.query;

    console.log('🚫 Payment cancelled redirect:', { paymentId, rideId });

    let payment = null;
    if (paymentId) {
      payment = await Payment.findById(paymentId);
      if (payment) {
        try {
          await syncPaymentStatusWithRevolut(payment);
        } catch (error) {
          console.error('Error syncing cancelled payment:', error);
        }
      }
    }

    // Render EJS template
    return res.render('revolut/payment-error', {
      errorMessage: 'Payment was cancelled',
      orderId: paymentId,
      amount: payment?.amount ? `£${payment.amount}` : 'N/A',
      paymentId: paymentId,
      rideId: rideId
    });
  } catch (error: any) {
    console.error('Error handling payment cancellation:', error);
    return res.status(500).send('Error processing payment cancellation');
  }
};

/**
 * Get payment details
 */
export const getPaymentDetails = async (req: IRequest, res: Response) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: 'Unauthorized'
      });
    }

    const payment = await Payment.findById(paymentId).populate('ride').populate('user', 'fullName email phoneNumber');
    if (!payment) {
      return res.status(404).json({
        status: false,
        message: 'Payment not found'
      });
    }

    if (payment.user._id.toString() !== String(userId)) {
      return res.status(403).json({
        status: false,
        message: 'Not authorized to access this payment'
      });
    }

    return res.status(200).json({
      status: true,
      message: 'Payment details retrieved successfully',
      data: payment
    });

  } catch (error: any) {
    console.error('Error getting payment details:', error);
    return res.status(500).json({
      status: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
