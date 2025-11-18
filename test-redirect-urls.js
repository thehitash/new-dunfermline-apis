const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

console.log('\n=== TESTING REDIRECT URL CONFIGURATION ===\n');
console.log('Backend URL from .env:', BACKEND_URL);
console.log('\nExpected Redirect URLs:');
console.log('✓ Success:', `${BACKEND_URL}/api/payment/success?paymentId=XXX&rideId=YYY`);
console.log('✓ Failure:', `${BACKEND_URL}/api/payment/failure?paymentId=XXX&rideId=YYY`);
console.log('✓ Cancel:', `${BACKEND_URL}/api/payment/cancel?paymentId=XXX&rideId=YYY`);
console.log('\nThese URLs will be sent to Revolut with the next payment.\n');

if (BACKEND_URL.includes('localhost')) {
  console.log('⚠️  WARNING: Using localhost URL!');
  console.log('   Revolut cannot reach localhost from the cloud.');
  console.log('   Make sure ngrok is running and BACKEND_URL is set correctly.\n');
} else {
  console.log('✅ Using public URL - Revolut can reach this!\n');
}
