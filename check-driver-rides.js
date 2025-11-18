// Script to check which rides drivers can see
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://thehitansh_db_user:2eZgxdYLtOQrMc2T@cluster0.c0sei96.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const rideSchema = new mongoose.Schema({}, { strict: false, collection: 'rides' });
const Ride = mongoose.model('Ride', rideSchema);

async function checkRides() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // This is the EXACT query that drivers see
    const driverVisibleRides = await Ride.find({
      status: 'pending',
      paymentStatus: 'completed',
      bookingMethod: { $ne: 'whatsapp' }
    });

    console.log('=== RIDES VISIBLE TO DRIVERS ===');
    console.log(`Found: ${driverVisibleRides.length} ride(s)\n`);

    if (driverVisibleRides.length > 0) {
      driverVisibleRides.forEach((ride, index) => {
        console.log(`Ride ${index + 1}:`);
        console.log(`  ID: ${ride._id}`);
        console.log(`  Status: ${ride.status}`);
        console.log(`  Payment Status: ${ride.paymentStatus}`);
        console.log(`  Booking Method: ${ride.bookingMethod}`);
        console.log(`  Estimated Fare: £${ride.estimatedFare}`);
        console.log(`  Created: ${ride.createdAt}`);
        console.log('');
      });
    } else {
      console.log('❌ No rides currently visible to drivers.');
      console.log('\nChecking for rides with other statuses...\n');

      // Check pending rides with processing payment
      const processingRides = await Ride.find({
        status: 'pending',
        paymentStatus: 'processing'
      });

      console.log(`⏳ Rides stuck in 'processing': ${processingRides.length}`);
      if (processingRides.length > 0) {
        console.log('   These rides need payment completion!');
        processingRides.forEach(ride => {
          console.log(`   - Ride ${ride._id} (created: ${ride.createdAt})`);
        });
      }

      // Check pending rides with pending payment
      const pendingPayment = await Ride.find({
        status: 'pending',
        paymentStatus: 'pending'
      });

      console.log(`\n💳 Rides awaiting payment: ${pendingPayment.length}`);
      if (pendingPayment.length > 0) {
        pendingPayment.forEach(ride => {
          console.log(`   - Ride ${ride._id} (created: ${ride.createdAt})`);
        });
      }

      // Check WhatsApp rides
      const whatsappRides = await Ride.find({
        status: 'pending',
        paymentStatus: 'completed',
        bookingMethod: 'whatsapp'
      });

      console.log(`\n📱 WhatsApp/Group rides (hidden from list): ${whatsappRides.length}`);
    }

    console.log('\n=================================\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkRides();
