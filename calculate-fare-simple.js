/**
 * Simple Fare Calculator - No Database Required
 *
 * Calculates fares based on typical vehicle pricing
 * Run: node calculate-fare-simple.js
 */

/**
 * Calculate fare for a given distance
 */
function calculateFare(vehicleName, baseFare, baseMileageLimit, pricePerMileAfterBase, distanceMiles) {
  let fare;
  let additionalMiles = 0;
  let additionalMilesCost = 0;

  if (distanceMiles <= baseMileageLimit) {
    // Within base mileage limit - charge flat base fare
    fare = baseFare;
  } else {
    // Beyond base mileage limit - charge base fare + additional per mile
    additionalMiles = distanceMiles - baseMileageLimit;
    additionalMilesCost = additionalMiles * pricePerMileAfterBase;
    fare = baseFare + additionalMilesCost;
  }

  return {
    vehicleName,
    baseFare,
    baseMileageLimit,
    pricePerMileAfterBase,
    distanceMiles: Math.round(distanceMiles * 10000) / 10000,
    additionalMiles: Math.round(additionalMiles * 10000) / 10000,
    additionalMilesCost: Math.round(additionalMilesCost * 10000) / 10000,
    totalFare: Math.round(fare * 10000) / 10000
  };
}

function showFareCalculations() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Dunfermline Taxi - Fare Calculator              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Typical vehicle configurations (adjust these based on your actual settings)
  const vehicles = [
    {
      name: '4 Seater Saloon',
      baseFare: 9,
      baseMileageLimit: 3,
      pricePerMileAfterBase: 3
    },
    {
      name: '6 Seater MPV',
      baseFare: 12,
      baseMileageLimit: 3,
      pricePerMileAfterBase: 3.5
    },
    {
      name: '8 Seater Minibus',
      baseFare: 15,
      baseMileageLimit: 3,
      pricePerMileAfterBase: 4
    }
  ];

  // Distances to calculate (including user's requested 1.44 miles)
  const distances = [1.44, 2, 3, 4, 5, 10, 15, 20];

  for (const vehicle of vehicles) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`🚗 ${vehicle.name}`);
    console.log('───────────────────────────────────────────────────────────');
    console.log(`   Base Fare: £${vehicle.baseFare.toFixed(4)} (up to ${vehicle.baseMileageLimit} miles)`);
    console.log(`   After ${vehicle.baseMileageLimit} miles: £${vehicle.pricePerMileAfterBase.toFixed(4)}/mile`);
    console.log('───────────────────────────────────────────────────────────');

    for (const distance of distances) {
      const result = calculateFare(
        vehicle.name,
        vehicle.baseFare,
        vehicle.baseMileageLimit,
        vehicle.pricePerMileAfterBase,
        distance
      );

      console.log('');
      console.log(`📏 ${result.distanceMiles} miles:`);

      if (result.additionalMiles > 0) {
        console.log(`   Base fare:        £${result.baseFare.toFixed(4)}`);
        console.log(`   Additional:       ${result.additionalMiles.toFixed(4)} miles × £${result.pricePerMileAfterBase.toFixed(4)} = £${result.additionalMilesCost.toFixed(4)}`);
        console.log(`   ────────────────────────────────`);
        console.log(`   Total fare:       £${result.totalFare.toFixed(4)}`);
      } else {
        console.log(`   Total fare:       £${result.baseFare.toFixed(4)}`);
        console.log(`   (within base limit of ${result.baseMileageLimit} miles)`);
      }
    }

    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('💡 Fare Calculation Formula:');
  console.log('');
  console.log('   If distance ≤ base mileage limit:');
  console.log('      Fare = Base Fare (flat rate)');
  console.log('');
  console.log('   If distance > base mileage limit:');
  console.log('      Fare = Base Fare + (Extra Miles × Price Per Mile)');
  console.log('');
  console.log('💡 Example for 1.44 miles with 4 Seater Saloon:');
  console.log('   Base limit: 3 miles');
  console.log('   Base fare: £9.00');
  console.log('   Since 1.44 miles < 3 miles → Fare = £9.00 (flat rate)');
  console.log('   No additional charges apply.');
  console.log('');
  console.log('💡 Example for 5 miles with 4 Seater Saloon:');
  console.log('   Base limit: 3 miles');
  console.log('   Base fare: £9.00');
  console.log('   Price per mile after base: £3.00');
  console.log('   Since 5 miles > 3 miles:');
  console.log('      Extra miles = 5 - 3 = 2 miles');
  console.log('      Additional cost = 2 × £3 = £6.00');
  console.log('      Total fare = £9.00 + £6.00 = £15.00');
  console.log('');
  console.log('📌 NOTE: These calculations use typical vehicle pricing.');
  console.log('   To see your actual database values, update the vehicle');
  console.log('   configurations at the top of this script.');
  console.log('');
}

// Run the calculator
showFareCalculations();
