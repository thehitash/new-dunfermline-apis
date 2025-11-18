const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://thehitansh_db_user:2eZgxdYLtOQrMc2T@cluster0.c0sei96.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function fixAll() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const ridesCollection = db.collection('rides');
    const paymentsCollection = db.collection('payments');
    
    // Find all rides with processing payment status
    const processingRides = await ridesCollection.find({
      status: 'pending',
      paymentStatus: 'processing'
    }).toArray();
    
    console.log(`Found ${processingRides.length} rides stuck in processing\n`);
    
    let fixed = 0;
    
    for (const ride of processingRides) {
      console.log(`Fixing Ride: ${ride._id}`);
      
      // Update ride
      await ridesCollection.updateOne(
        { _id: ride._id },
        { 
          $set: { 
            paymentStatus: 'completed',
            updatedAt: new Date()
          } 
        }
      );
      
      // Update payment if exists
      if (ride.paymentId) {
        await paymentsCollection.updateOne(
          { _id: new mongoose.Types.ObjectId(ride.paymentId) },
          { 
            $set: { 
              status: 'completed',
              completedAt: new Date(),
              updatedAt: new Date()
            } 
          }
        );
      }
      
      fixed++;
      console.log(`  ✅ Fixed (${fixed}/${processingRides.length})`);
    }
    
    console.log(`\n✅ SUCCESS! Fixed ${fixed} rides.`);
    console.log('Drivers should now see all these rides!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAll();
