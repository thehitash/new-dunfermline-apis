/**
 * Manually Verify Payment Status
 *
 * Use this when payment is completed on Revolut but status stuck at "processing" in DB
 * This manually fetches the status from Revolut and updates the database
 *
 * Usage:
 *   node manual-verify-payment.js <payment_id>
 *
 * Example:
 *   node manual-verify-payment.js 673a1234567890abcdef1234
 */

const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
const REVOLUT_API_URL = process.env.REVOLUT_MERCHANT_BASE_URL || 'https://merchant.revolut.com';
const REVOLUT_API_KEY = process.env.REVOLUT_MERCHANT_SECRET;
const REVOLUT_API_VERSION = process.env.REVOLUT_API_VERSION || '2024-09-01';

// Connect to MongoDB
mongoose.connect(MONGODB_URI);

// Import models
const Payment = require('./src/api/models/payment').default;
const Ride = require('./src/api/models/ride').default;
const User = require('./src/api/models/user').default;

async function manualVerifyPayment(paymentId) {
  try {
    console.log('🔍 Looking up payment:', paymentId);

    // Find payment
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      console.error('❌ Payment not found in database');
      process.exit(1);
    }

    console.log('✅ Payment found in database');
    console.log('   Current Status:', payment.status);
    console.log('   Revolut Order ID:', payment.revolutOrderId);
    console.log('   Amount:', payment.amount, payment.currency);
    console.log('');

    if (!payment.revolutOrderId) {
      console.error('❌ No Revolut order ID found');
      process.exit(1);
    }

    // Check with Revolut
    console.log('📞 Checking status with Revolut...');
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
    console.log('');
    console.log('📦 Revolut Order Status:', revolutOrder.state);
    console.log('📦 Order ID:', revolutOrder.id);
    console.log('📦 Amount:', revolutOrder.amount / 100, revolutOrder.currency);
    console.log('📦 Created:', revolutOrder.created_at);
    console.log('📦 Updated:', revolutOrder.updated_at);
    console.log('');

    // Map Revolut status to our payment status
    let newStatus = 'processing';
    if (revolutOrder.state === 'COMPLETED') {
      newStatus = 'completed';
    } else if (revolutOrder.state === 'CANCELLED' || revolutOrder.state === 'FAILED') {
      newStatus = 'failed';
    } else if (revolutOrder.state === 'PENDING' || revolutOrder.state === 'PROCESSING') {
      newStatus = 'processing';
    }

    console.log('🔄 Updating database...');
    console.log('   Old Status:', payment.status);
    console.log('   New Status:', newStatus);
    console.log('');

    // Update payment
    if (newStatus === 'completed' && payment.status !== 'completed') {
      payment.status = 'completed';
      payment.completedAt = new Date();
      payment.transactionId = revolutOrder.id;
      payment.metadata = revolutOrder;
      await payment.save();
      console.log('✅ Payment updated to COMPLETED');

      // Update ride
      const ride = await Ride.findById(payment.ride);
      if (ride) {
        ride.paymentStatus = 'completed';
        await ride.save();
        console.log('✅ Ride payment status updated to COMPLETED');

        // Notify drivers if this is an app booking
        if (ride.bookingMethod === 'app') {
          console.log('');
          console.log('📢 Notifying drivers about completed payment...');

          // Populate ride info
          await ride.populate('rider', 'fullName phoneNumber');
          await ride.populate('vehicle', 'name capacity type');

          // Find all drivers
          const drivers = await User.find({ userType: 'driver' });
          console.log(`📍 Found ${drivers.length} drivers`);

          // Send socket notification
          const { getIO } = require('./src/socket/socketInstance');
          const io = getIO();
          if (io) {
            io.emit('new_ride_request', ride);
            console.log('✅ Socket notification sent');
          }

          // Send push notification
          const notificationService = require('./src/services/notificationService').default;
          const driverIds = drivers.map(driver => driver._id.toString());

          const pickupName = ride.pickupLocation?.name || ride.pickupLocation?.address || 'Pickup location';
          const destName = ride.destinationLocation?.name || ride.destinationLocation?.address || 'Destination';

          const notificationPayload = {
            title: '🚖 New Ride Request!',
            body: `Pickup: ${pickupName}\nDestination: ${destName}`,
            data: {
              type: 'new_ride_request',
              rideId: ride._id.toString(),
              pickupLocation: pickupName,
              destinationLocation: destName,
              estimatedFare: ride.estimatedFare?.toString() || '',
            }
          };

          const result = await notificationService.sendToMultipleUsers(
            driverIds,
            notificationPayload,
            { channelId: 'ride_updates', priority: 'high' }
          );

          console.log(`✅ Push notifications sent - Success: ${result.successCount}, Failed: ${result.failureCount}`);
        }
      }
    } else {
      payment.status = newStatus;
      payment.metadata = revolutOrder;
      await payment.save();
      console.log('✅ Payment status updated');

      // Update ride
      const ride = await Ride.findById(payment.ride);
      if (ride) {
        ride.paymentStatus = newStatus;
        await ride.save();
        console.log('✅ Ride payment status updated');
      }
    }

    console.log('');
    console.log('🎉 Manual verification complete!');
    console.log('');
    console.log('Summary:');
    console.log('  Payment ID:', paymentId);
    console.log('  Revolut Status:', revolutOrder.state);
    console.log('  Database Status:', newStatus);
    console.log('  Ride Notified:', ride?.bookingMethod === 'app' && newStatus === 'completed' ? 'Yes' : 'No');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Get payment ID from command line
const paymentId = process.argv[2];

if (!paymentId) {
  console.error('❌ Please provide a payment ID');
  console.error('');
  console.error('Usage:');
  console.error('  node manual-verify-payment.js <payment_id>');
  console.error('');
  console.error('Example:');
  console.error('  node manual-verify-payment.js 673a1234567890abcdef1234');
  console.error('');
  console.error('To find payment ID:');
  console.error('  - Check backend logs for "Payment ID: ..."');
  console.error('  - Or check MongoDB payments collection');
  process.exit(1);
}

if (!MONGODB_URI || !REVOLUT_API_KEY) {
  console.error('❌ Missing environment variables');
  console.error('   MONGODB_URI:', !!MONGODB_URI);
  console.error('   REVOLUT_API_KEY:', !!REVOLUT_API_KEY);
  process.exit(1);
}

console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║   Manual Payment Verification Tool     ║');
console.log('╚════════════════════════════════════════╝');
console.log('');

manualVerifyPayment(paymentId);
