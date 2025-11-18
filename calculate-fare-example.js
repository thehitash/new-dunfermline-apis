/**
 * Fare Calculator - Example Calculations
 *
 * Shows fare calculations for different distances
 * Run: node calculate-fare-example.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(MONGODB_URI);

// Import model
const Vehicle = require('./src/api/models/vehicle').default;

/**
 * Calculate fare for a given distance
 */
function calculateFare(vehicle, distanceMiles) {
  let fare;
  let additionalMiles = 0;
  let additionalMilesCost = 0;

  if (distanceMiles <= vehicle.baseMileageLimit) {
    // Within base mileage limit - charge flat base fare
    fare = vehicle.baseFare;
  } else {
    // Beyond base mileage limit - charge base fare + additional per mile
    additionalMiles = distanceMiles - vehicle.baseMileageLimit;
    additionalMilesCost = additionalMiles * vehicle.pricePerMileAfterBase;
    fare = vehicle.baseFare + additionalMilesCost;
  }

  return {
    baseFare: vehicle.baseFare,
    baseMileageLimit: vehicle.baseMileageLimit,
    pricePerMileAfterBase: vehicle.pricePerMileAfterBase,
    additionalMiles: Math.round(additionalMiles * 100) / 100,
    additionalMilesCost: Math.round(additionalMilesCost * 100) / 100,
    totalFare: Math.round(fare * 100) / 100
  };
}

async function showFareExamples() {
  try {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           Dunfermline Taxi - Fare Calculator              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    // Get all vehicles
    const vehicles = await Vehicle.find({ isActive: true }).sort({ capacity: 1 });

    if (vehicles.length === 0) {
      console.log('❌ No vehicles found in database');
      console.log('   Run the seed script first: npm run seed');
      process.exit(1);
    }

    console.log(`Found ${vehicles.length} active vehicle(s)`);
    console.log('');

    // Example distances to calculate
    const exampleDistances = [1.44, 2, 3, 4, 5, 10, 15];

    for (const vehicle of vehicles) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`🚗 ${vehicle.name} (${vehicle.capacity} seater)`);
      console.log('───────────────────────────────────────────────────────────');
      console.log(`   Base Fare: £${vehicle.baseFare} (up to ${vehicle.baseMileageLimit} miles)`);
      console.log(`   After ${vehicle.baseMileageLimit} miles: £${vehicle.pricePerMileAfterBase}/mile`);
      console.log('───────────────────────────────────────────────────────────');

      for (const distance of exampleDistances) {
        const result = calculateFare(vehicle, distance);

        console.log('');
        console.log(`📏 ${distance} miles:`);

        if (result.additionalMiles > 0) {
          console.log(`   Base fare:        £${result.baseFare.toFixed(2)}`);
          console.log(`   Additional:       ${result.additionalMiles} miles × £${result.pricePerMileAfterBase} = £${result.additionalMilesCost.toFixed(2)}`);
          console.log(`   ────────────────────────────────`);
          console.log(`   Total fare:       £${result.totalFare.toFixed(2)}`);
        } else {
          console.log(`   Base fare:        £${result.baseFare.toFixed(2)}`);
          console.log(`   (within base limit)`);
        }
      }

      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('💡 Formula:');
    console.log('   If distance <= base limit:');
    console.log('      Fare = Base Fare');
    console.log('');
    console.log('   If distance > base limit:');
    console.log('      Fare = Base Fare + (Extra Miles × Price Per Mile)');
    console.log('');
    console.log('💡 Example for 1.44 miles:');
    console.log('   If base limit is 3 miles and base fare is £9:');
    console.log('      1.44 miles is within 3 miles');
    console.log('      So fare = £9.00 (flat rate)');
    console.log('');
    console.log('💡 Example for 5 miles:');
    console.log('   If base limit is 3 miles, base fare is £9, and £3/mile:');
    console.log('      5 miles exceeds 3 miles by 2 miles');
    console.log('      So fare = £9 + (2 × £3) = £15.00');
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

showFareExamples();
