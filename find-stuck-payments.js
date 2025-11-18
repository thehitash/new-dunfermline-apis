/**
 * Find Stuck Payments
 *
 * Finds payments that are stuck in "processing" status
 * and shows their details so you can manually verify them
 *
 * Usage:
 *   node find-stuck-payments.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(MONGODB_URI);

// Import models
const Payment = require('./src/api/models/payment').default;
const Ride = require('./src/api/models/ride').default;

async function findStuckPayments() {
  try {
    console.log('🔍 Searching for stuck payments...');
    console.log('');

    // Find payments in processing status
    const stuckPayments = await Payment.find({
      status: 'processing',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    })
    .populate('user', 'fullName email phoneNumber')
    .populate('ride')
    .sort({ createdAt: -1 })
    .limit(20);

    if (stuckPayments.length === 0) {
      console.log('✅ No stuck payments found!');
      console.log('   All payments are either completed or failed.');
      process.exit(0);
    }

    console.log(`Found ${stuckPayments.length} payment(s) in "processing" status:`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');

    for (const payment of stuckPayments) {
      const ride = payment.ride;
      const user = payment.user;

      console.log('');
      console.log(`Payment ID: ${payment._id}`);
      console.log(`Status: ${payment.status}`);
      console.log(`Amount: £${payment.amount} ${payment.currency}`);
      console.log(`Created: ${payment.createdAt.toLocaleString('en-GB')}`);
      console.log(`Revolut Order ID: ${payment.revolutOrderId || 'N/A'}`);

      if (user) {
        console.log(`Customer: ${user.fullName || 'Unknown'} (${user.email || user.phoneNumber})`);
      }

      if (ride) {
        const pickup = ride.pickupLocation?.name || ride.pickupLocation?.address || 'Unknown';
        const dest = ride.destinationLocation?.name || ride.destinationLocation?.address || 'Unknown';
        console.log(`Ride: ${pickup} → ${dest}`);
        console.log(`Ride Status: ${ride.status}`);
      }

      console.log('');
      console.log(`To manually verify this payment, run:`);
      console.log(`  node manual-verify-payment.js ${payment._id}`);
      console.log('───────────────────────────────────────────────────────────────');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Summary:');
    console.log(`  Total stuck payments: ${stuckPayments.length}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run manual-verify-payment.js for each payment ID above');
    console.log('  2. Configure Revolut webhook to prevent future stuck payments');
    console.log('  3. See WEBHOOK_SETUP_GUIDE.md for instructions');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file');
  process.exit(1);
}

console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║     Find Stuck Payments Tool           ║');
console.log('╚════════════════════════════════════════╝');
console.log('');

findStuckPayments();
