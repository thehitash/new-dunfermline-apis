import { Request, Response } from 'express';
import axios from 'axios';
import Payment from '../models/payment';
import Ride from '../models/ride';
import { IRequest } from '../middlewares/authMiddleware';

// Revolut API configuration
// Using your existing environment variables
const REVOLUT_API_URL = process.env.REVOLUT_MERCHANT_BASE_URL || 'https://merchant.revolut.com';
const REVOLUT_API_KEY = process.env.REVOLUT_MERCHANT_SECRET || '';
const REVOLUT_API_VERSION = process.env.REVOLUT_API_VERSION || '2024-09-01';

/**
 * Initiate payment with Revolut
 * Creates a payment order and returns the payment URL for webview
 */
export const initiatePayment = async (req: IRequest, res: Response) => {
  try {
    const { rideId, amount, currency = 'GBP' } = req.body;
    const userId = req.user?._id;

    console.log('=== INITIATE PAYMENT (Backend) ===');
    console.log('🆔 User ID from token:', userId);
    console.log('🚕 Ride ID:', rideId);
    console.log('💷 Amount:', amount);
    console.log('💵 Currency:', currency);

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: 'Unauthorized'
      });
    }

    // Validate input
    if (!rideId || !amount) {
      return res.status(400).json({
        status: false,
        message: 'Missing required fields: rideId and amount'
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

    // Create payment record
    const payment = new Payment({
      ride: rideId,
      user: userId,
      amount: amount,
      currency: currency,
      paymentMethod: 'revolut',
      status: 'pending'
    });

    await payment.save();

    // Create Revolut order
    try {
      const revolutResponse = await axios.post(
        `${REVOLUT_API_URL}/api/orders`,
        {
          amount: Math.round(amount * 100), // Convert to cents
          currency: currency,
          merchant_order_ext_ref: String(payment._id),
          description: `Payment for ride #${rideId}`,
          customer_email: req.user?.email || undefined,
          settlement_currency: currency,
          metadata: {
            rideId: rideId,
            userId: String(userId),
            paymentId: String(payment._id)
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${REVOLUT_API_KEY}`,
            'Content-Type': 'application/json',
            'Revolut-Api-Version': REVOLUT_API_VERSION
          }
        }
      );

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
        amount: amount,
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
          amount: amount,
          currency: currency
        }
      });

    } catch (revolutError: any) {
      console.error('Revolut API Error:', revolutError.response?.data || revolutError.message);

      payment.status = 'failed';
      payment.errorMessage = revolutError.response?.data?.message || 'Failed to create Revolut order';
      await payment.save();

      return res.status(500).json({
        status: false,
        message: 'Failed to initiate payment with Revolut',
        error: revolutError.response?.data || revolutError.message
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

    // If payment is already completed, return success
    if (payment.status === 'completed') {
      return res.status(200).json({
        status: true,
        message: 'Payment already completed',
        data: {
          paymentId: payment._id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency
        }
      });
    }

    // Check status with Revolut
    try {
      const revolutResponse = await axios.get(
        `${REVOLUT_API_URL}/api/orders/${payment.revolutOrderId}`,
        {
          headers: {
            'Authorization': `Bearer ${REVOLUT_API_KEY}`,
            'Content-Type': 'application/json',
            'Revolut-Api-Version': REVOLUT_API_VERSION
          }
        }
      );

      const revolutOrder = revolutResponse.data;
      const revolutStatus = revolutOrder.state;

      // Map Revolut status to our payment status
      let newStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' = 'processing';

      if (revolutStatus === 'COMPLETED') {
        newStatus = 'completed';
        payment.completedAt = new Date();
        payment.transactionId = revolutOrder.id;
      } else if (revolutStatus === 'CANCELLED' || revolutStatus === 'FAILED') {
        newStatus = 'failed';
        payment.errorMessage = revolutOrder.cancel_reason || 'Payment failed';
      } else if (revolutStatus === 'PENDING' || revolutStatus === 'PROCESSING') {
        newStatus = 'processing';
      }

      payment.status = newStatus;
      payment.metadata = revolutOrder;
      await payment.save();

      // Update ride payment status
      const ride = await Ride.findById(payment.ride);
      if (ride) {
        ride.paymentStatus = newStatus;
        await ride.save();

        // If payment completed, notify all drivers about the ride
        if (newStatus === 'completed' && ride.bookingMethod === 'app') {
          console.log('💳 Payment completed - Notifying drivers about new ride...');

          // Populate ride info
          await ride.populate('rider', 'fullName phoneNumber');
          await ride.populate('vehicle', 'name capacity type');

          // Find all drivers
          const User = require('../models/user').default;
          const drivers = await User.find({
            userType: 'driver',
          });

          console.log(`📍 Found ${drivers.length} drivers to notify`);

          // Send real-time socket notification
          const { getIO } = require('../../socket/socketInstance');
          const io = getIO();
          if (io) {
            io.emit('new_ride_request', ride);
          }

          // Send push notification to all drivers
          const notificationService = require('../../services/notificationService').default;
          const driverIds = drivers.map((driver: any) => driver._id.toString());

          const pickupName = (ride.pickupLocation as any)?.name || (ride.pickupLocation as any)?.address || 'Pickup location';
          const destName = (ride.destinationLocation as any)?.name || (ride.destinationLocation as any)?.address || 'Destination';

          const notificationPayload = {
            title: '🚖 New Ride Request!',
            body: `Pickup: ${pickupName}\nDestination: ${destName}`,
            data: {
              type: 'new_ride_request',
              rideId: (ride._id as any).toString(),
              pickupLocation: pickupName,
              destinationLocation: destName,
              estimatedFare: ride.estimatedFare?.toString() || '',
            }
          };

          console.log('📲 Sending push notification to drivers after payment...');
          const result = await notificationService.sendToMultipleUsers(
            driverIds,
            notificationPayload,
            { channelId: 'ride_updates', priority: 'high' }
          );

          console.log(`✅ Push notification sent - Success: ${result.successCount}, Failed: ${result.failureCount}`);
        }
      }

      return res.status(200).json({
        status: true,
        message: 'Payment status retrieved successfully',
        data: {
          paymentId: payment._id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          revolutStatus: revolutStatus
        }
      });

    } catch (revolutError: any) {
      console.error('Revolut API Error:', revolutError.response?.data || revolutError.message);

      return res.status(500).json({
        status: false,
        message: 'Failed to verify payment with Revolut',
        error: revolutError.response?.data || revolutError.message
      });
    }

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

    // Update payment status based on webhook event
    let newStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' = payment.status;

    if (event === 'ORDER_COMPLETED' || order.state === 'COMPLETED') {
      newStatus = 'completed';
      payment.completedAt = new Date();
      payment.transactionId = order.id;
    } else if (event === 'ORDER_CANCELLED' || order.state === 'CANCELLED') {
      newStatus = 'failed';
      payment.errorMessage = order.cancel_reason || 'Payment cancelled';
    } else if (event === 'ORDER_AUTHORISED' || order.state === 'PROCESSING') {
      newStatus = 'processing';
    }

    payment.status = newStatus;
    payment.metadata = order;
    await payment.save();

    // Update ride payment status
    const ride = await Ride.findById(payment.ride);
    if (ride) {
      ride.paymentStatus = newStatus;
      await ride.save();

      // If payment completed via webhook, notify all drivers about the ride
      if (newStatus === 'completed' && ride.bookingMethod === 'app') {
        console.log('💳 Payment completed via webhook - Notifying drivers about new ride...');

        // Populate ride info
        await ride.populate('rider', 'fullName phoneNumber');
        await ride.populate('vehicle', 'name capacity type');

        // Find all drivers
        const User = require('../models/user').default;
        const drivers = await User.find({
          userType: 'driver',
        });

        console.log(`📍 Found ${drivers.length} drivers to notify`);

        // Send real-time socket notification
        const { getIO } = require('../../socket/socketInstance');
        const io = getIO();
        if (io) {
          io.emit('new_ride_request', ride);
        }

        // Send push notification to all drivers
        const notificationService = require('../../services/notificationService').default;
        const driverIds = drivers.map((driver: any) => driver._id.toString());

        const pickupName = (ride.pickupLocation as any)?.name || (ride.pickupLocation as any)?.address || 'Pickup location';
        const destName = (ride.destinationLocation as any)?.name || (ride.destinationLocation as any)?.address || 'Destination';

        const notificationPayload = {
          title: '🚖 New Ride Request!',
          body: `Pickup: ${pickupName}\nDestination: ${destName}`,
          data: {
            type: 'new_ride_request',
            rideId: (ride._id as any).toString(),
            pickupLocation: pickupName,
            destinationLocation: destName,
            estimatedFare: ride.estimatedFare?.toString() || '',
          }
        };

        console.log('📲 Sending push notification to drivers after payment webhook...');
        const result = await notificationService.sendToMultipleUsers(
          driverIds,
          notificationPayload,
          { channelId: 'ride_updates', priority: 'high' }
        );

        console.log(`✅ Push notification sent - Success: ${result.successCount}, Failed: ${result.failureCount}`);
      }
    }

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
