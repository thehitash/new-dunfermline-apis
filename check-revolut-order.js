/**
 * Check Revolut Order Status
 *
 * This script helps debug payment issues by checking the status of a Revolut order.
 *
 * Usage:
 *   node check-revolut-order.js <order_id>
 *
 * Example:
 *   node check-revolut-order.js 690b64f4-02fc-ac97-b6be-2a7ad49be37e
 */

const axios = require('axios');
require('dotenv').config();

const REVOLUT_API_URL = process.env.REVOLUT_MERCHANT_BASE_URL || 'https://merchant.revolut.com';
const REVOLUT_API_KEY = process.env.REVOLUT_MERCHANT_SECRET;
const REVOLUT_API_VERSION = process.env.REVOLUT_API_VERSION || '2024-09-01';

async function checkOrder(orderId) {
  try {
    console.log('🔍 Checking Revolut order:', orderId);
    console.log('🔗 API URL:', REVOLUT_API_URL);
    console.log('');

    const response = await axios.get(
      `${REVOLUT_API_URL}/api/orders/${orderId}`,
      {
        headers: {
          'Authorization': `Bearer ${REVOLUT_API_KEY}`,
          'Content-Type': 'application/json',
          'Revolut-Api-Version': REVOLUT_API_VERSION
        }
      }
    );

    console.log('✅ Order Found!');
    console.log('');
    console.log('📦 Order Details:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const order = response.data;
    console.log('📊 Summary:');
    console.log('   State:', order.state);
    console.log('   Amount:', order.amount / 100, order.currency);
    console.log('   Created:', order.created_at);
    console.log('   Updated:', order.updated_at);

    if (order.state === 'FAILED' || order.state === 'CANCELLED') {
      console.log('   ❌ Failure Reason:', order.cancel_reason || 'Not specified');
    }

    if (order.payments && order.payments.length > 0) {
      console.log('');
      console.log('💳 Payments:');
      order.payments.forEach((payment, index) => {
        console.log(`   Payment ${index + 1}:`);
        console.log('     State:', payment.state);
        console.log('     Method:', payment.payment_method?.type);
        if (payment.failure_reason) {
          console.log('     ❌ Failure Reason:', payment.failure_reason);
        }
      });
    }

  } catch (error) {
    console.error('');
    console.error('❌ Error checking order:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Message:', error.message);
    }
  }
}

// Get order ID from command line
const orderId = process.argv[2];

if (!orderId) {
  console.error('❌ Please provide an order ID');
  console.error('');
  console.error('Usage:');
  console.error('  node check-revolut-order.js <order_id>');
  console.error('');
  console.error('Example:');
  console.error('  node check-revolut-order.js 690b64f4-02fc-ac97-b6be-2a7ad49be37e');
  process.exit(1);
}

if (!REVOLUT_API_KEY) {
  console.error('❌ REVOLUT_MERCHANT_SECRET not found in .env file');
  process.exit(1);
}

checkOrder(orderId);
