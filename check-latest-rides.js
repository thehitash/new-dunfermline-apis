const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://thehitansh_db_user:2eZgxdYLtOQrMc2T@cluster0.c0sei96.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const rideSchema = new mongoose.Schema({}, { strict: false, collection: 'rides' });
const Ride = mongoose.model('Ride', rideSchema);

const paymentSchema = new mongoose.Schema({}, { strict: false, collection: 'payments' });
const Payment = mongoose.model('Payment', paymentSchema);

async function checkLatest() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    console.log('\n=== LATEST 3 RIDES ===\n');
    const rides = await Ride.find().sort({ createdAt: -1 }).limit(3);
    
    for (const ride of rides) {
      console.log(`Ride ID: ${ride._id}`);
      console.log(`  Status: ${ride.status}`);
      console.log(`  Payment Status: ${ride.paymentStatus}`);
      console.log(`  Payment ID: ${ride.paymentId}`);
      console.log(`  Created: ${ride.createdAt}`);
      console.log(`  Updated: ${ride.updatedAt}`);
      
      if (ride.paymentId) {
        const payment = await Payment.findById(ride.paymentId);
        if (payment) {
          console.log(`  Payment Doc Status: ${payment.status}`);
          console.log(`  Revolut Order ID: ${payment.revolutOrderId}`);
        }
      }
      console.log('');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkLatest();
