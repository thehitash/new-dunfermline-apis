const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://thehitansh_db_user:2eZgxdYLtOQrMc2T@cluster0.c0sei96.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const rideSchema = new mongoose.Schema({}, { strict: false, collection: 'rides' });
const Ride = mongoose.model('Ride', rideSchema);

async function checkRide() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const ride = await Ride.findById('690b94404ee7f75989d3c8a5');
    console.log('\nRide Details:');
    console.log('ID:', ride._id);
    console.log('Status:', ride.status);
    console.log('Payment Status:', ride.paymentStatus);
    console.log('Booking Method:', ride.bookingMethod);
    console.log('Updated At:', ride.updatedAt);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkRide();
