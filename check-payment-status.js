/**
 * Check Payment Status
 *
 * Verifies payment status in database and fixes any inconsistencies
 *
 * Usage:
 *   node check-payment-status.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(MONGODB_URI);

// Import models
const Payment = require('./src/api/models/payment').default;
const Ride = require('./src/api/models/ride').default;

async function checkPaymentStatus() {
  try {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║    Payment Status Check Tool           ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');

    // Find recent rides
    console.log('🔍 Checking recent rides...');
    console.log('');

    const rides = await Ride.find({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('rider', 'fullName email phoneNumber')
    .lean();

    console.log(`Found ${rides.length} rides from the last 7 days:`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');

    for (const ride of rides) {
      console.log('');
      console.log(`Ride ID: ${ride._id}`);
      console.log(`Created: ${new Date(ride.createdAt).toLocaleString('en-GB')}`);
      console.log(`Status: ${ride.status}`);
      console.log(`Payment Status: ${ride.paymentStatus}`);
      console.log(`Payment Method: ${ride.paymentMethod || 'N/A'}`);
      console.log(`Payment ID: ${ride.paymentId || 'N/A'}`);

      if (ride.rider) {
        console.log(`Customer: ${ride.rider.fullName || 'Unknown'}`);
      }

      const pickup = ride.pickupLocation?.name || ride.pickupLocation?.address || 'Unknown';
      const dest = ride.destinationLocation?.name || ride.destinationLocation?.address || 'Unknown';
      console.log(`Route: ${pickup} → ${dest}`);

      // Check if payment exists
      if (ride.paymentId) {
        const payment = await Payment.findById(ride.paymentId).lean();
        if (payment) {
          console.log('');
          console.log('  💳 Payment Details:');
          console.log(`     Payment Status: ${payment.status}`);
          console.log(`     Amount: £${payment.amount} ${payment.currency}`);
          console.log(`     Method: ${payment.paymentMethod}`);

          if (payment.completedAt) {
            console.log(`     Completed: ${new Date(payment.completedAt).toLocaleString('en-GB')}`);
          }

          // Check for inconsistency
          if (payment.status !== ride.paymentStatus) {
            console.log('');
            console.log('  ⚠️  WARNING: Payment status mismatch!');
            console.log(`     Payment.status: ${payment.status}`);
            console.log(`     Ride.paymentStatus: ${ride.paymentStatus}`);
            console.log('');
            console.log('  💡 To fix, run:');
            console.log(`     node manual-verify-payment.js ${payment._id}`);
          }
        } else {
          console.log('');
          console.log('  ⚠️  WARNING: Payment ID exists but payment not found!');
        }
      }

      console.log('───────────────────────────────────────────────────────────────');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    // Summary
    const pendingCount = rides.filter(r => r.paymentStatus === 'pending').length;
    const processingCount = rides.filter(r => r.paymentStatus === 'processing').length;
    const completedCount = rides.filter(r => r.paymentStatus === 'completed').length;
    const failedCount = rides.filter(r => r.paymentStatus === 'failed').length;
    const invalidCount = rides.filter(r =>
      !['pending', 'processing', 'completed', 'failed', 'refunded'].includes(r.paymentStatus)
    ).length;

    console.log('📊 Summary:');
    console.log(`   Total Rides: ${rides.length}`);
    console.log(`   Pending: ${pendingCount}`);
    console.log(`   Processing: ${processingCount}`);
    console.log(`   Completed: ${completedCount}`);
    console.log(`   Failed: ${failedCount}`);

    if (invalidCount > 0) {
      console.log(`   ⚠️  Invalid Status: ${invalidCount}`);
    }

    console.log('');

    // Check for valid enum values
    console.log('📋 Valid Payment Status Values:');
    console.log('   - pending');
    console.log('   - processing');
    console.log('   - completed');
    console.log('   - failed');
    console.log('   - refunded');
    console.log('');
    console.log('⚠️  NOTE: "paid" is NOT a valid status!');
    console.log('   If you see "paid", it should be "completed"');
    console.log('');

    // Check for stuck payments
    if (processingCount > 0) {
      console.log('');
      console.log('💡 Found payments in "processing" status.');
      console.log('   To fix stuck payments, run:');
      console.log('   node find-stuck-payments.js');
      console.log('');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file');
  process.exit(1);
}

checkPaymentStatus();
