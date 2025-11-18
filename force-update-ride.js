const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://thehitansh_db_user:2eZgxdYLtOQrMc2T@cluster0.c0sei96.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function forceUpdate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Update ride directly using MongoDB driver
    const ridesCollection = db.collection('rides');
    const paymentsCollection = db.collection('payments');
    
    const rideId = new mongoose.Types.ObjectId('690b94404ee7f75989d3c8a5');
    const paymentId = new mongoose.Types.ObjectId('690b94404ee7f75989d3c8ab');
    
    console.log('\nUpdating ride...');
    const rideResult = await ridesCollection.updateOne(
      { _id: rideId },
      { 
        $set: { 
          paymentStatus: 'completed',
          updatedAt: new Date()
        } 
      }
    );
    console.log('Ride update result:', rideResult);
    
    console.log('\nUpdating payment...');
    const paymentResult = await paymentsCollection.updateOne(
      { _id: paymentId },
      { 
        $set: { 
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date()
        } 
      }
    );
    console.log('Payment update result:', paymentResult);
    
    // Verify
    console.log('\nVerifying updates...');
    const updatedRide = await ridesCollection.findOne({ _id: rideId });
    console.log('Ride paymentStatus:', updatedRide.paymentStatus);
    console.log('Ride status:', updatedRide.status);
    
    const updatedPayment = await paymentsCollection.findOne({ _id: paymentId });
    console.log('Payment status:', updatedPayment.status);
    
    if (updatedRide.paymentStatus === 'completed' && updatedRide.status === 'pending') {
      console.log('\n✅ SUCCESS! Drivers should now see this ride.');
    } else {
      console.log('\n❌ Update failed or ride not in correct state.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

forceUpdate();
