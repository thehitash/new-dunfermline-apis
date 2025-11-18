// Quick script to fix the pending ride that's stuck in processing
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://thehitansh_db_user:2eZgxdYLtOQrMc2T@cluster0.c0sei96.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const rideSchema = new mongoose.Schema({}, { strict: false, collection: 'rides' });
const Ride = mongoose.model('Ride', rideSchema);

const paymentSchema = new mongoose.Schema({}, { strict: false, collection: 'payments' });
const Payment = mongoose.model('Payment', paymentSchema);

async function fixRide() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const rideId = '690b94404ee7f75989d3c8a5';
    const paymentId = '690b94404ee7f75989d3c8ab';

    // Update ride
    const ride = await Ride.findById(rideId);
    if (ride) {
      console.log('\nBEFORE UPDATE:');
      console.log('Ride paymentStatus:', ride.paymentStatus);
      console.log('Ride status:', ride.status);

      ride.paymentStatus = 'completed';
      await ride.save();

      console.log('\nAFTER UPDATE:');
      console.log('Ride paymentStatus:', ride.paymentStatus);
      console.log('✅ Ride updated successfully');
    } else {
      console.log('❌ Ride not found');
    }

    // Update payment
    const payment = await Payment.findById(paymentId);
    if (payment) {
      console.log('\nPAYMENT BEFORE:');
      console.log('Payment status:', payment.status);

      payment.status = 'completed';
      payment.completedAt = new Date();
      await payment.save();

      console.log('\nPAYMENT AFTER:');
      console.log('Payment status:', payment.status);
      console.log('✅ Payment updated successfully');
    } else {
      console.log('❌ Payment not found');
    }

    console.log('\n✅ Done! Now drivers should see this ride.');
    console.log('Check DriverHome screen in the app.');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixRide();
