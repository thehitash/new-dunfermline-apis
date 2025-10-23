import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Vehicle from '../api/models/vehicle';

// Load environment variables
dotenv.config();

const vehicles = [
  {
    name: 'Comfort 4 Seater',
    type: 'comfort',
    capacity: 4,
    description: 'Comfortable sedan for up to 4 passengers with ample luggage space',
    baseFare: 9.00, // €9 for rides up to 3 miles
    baseMileageLimit: 3, // 3 miles included in base fare
    pricePerMileAfterBase: 3.00, // €3 per additional mile after 3 miles
    features: [
      'Air conditioning',
      'Comfortable seating',
      'Luggage space for 2-3 bags',
      'Professional driver',
      'GPS tracking'
    ],
    isActive: true
  },
  {
    name: 'Comfort 8 Seater',
    type: 'comfort',
    capacity: 8,
    description: 'Spacious minivan for up to 8 passengers, perfect for groups and families',
    baseFare: 9.00, // €9 for rides up to 3 miles
    baseMileageLimit: 3, // 3 miles included in base fare
    pricePerMileAfterBase: 3.00, // €3 per additional mile after 3 miles
    features: [
      'Air conditioning',
      'Extra spacious seating',
      'Large luggage capacity',
      'Professional driver',
      'GPS tracking',
      'Perfect for groups',
      'Family friendly'
    ],
    isActive: true
  }
];

const seedVehicles = async () => {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing vehicles
    console.log('🗑️  Clearing existing vehicles...');
    await Vehicle.deleteMany({});
    console.log('✅ Existing vehicles cleared');

    // Insert new vehicles
    console.log('📝 Seeding vehicles...');
    const createdVehicles = await Vehicle.insertMany(vehicles);

    console.log('✅ Successfully seeded vehicles:');
    createdVehicles.forEach((vehicle) => {
      console.log(`   - ${vehicle.name} (${vehicle.capacity} seats)`);
      console.log(`     Base fare: £${vehicle.baseFare} (up to ${vehicle.baseMileageLimit} miles)`);
      console.log(`     Additional: £${vehicle.pricePerMileAfterBase} per mile after ${vehicle.baseMileageLimit} miles`);
    });

    console.log('\n🎉 Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding vehicles:', error);
    process.exit(1);
  }
};

// Run the seed function
seedVehicles();
