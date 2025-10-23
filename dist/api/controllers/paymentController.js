"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentDetails = exports.cancelPayment = exports.handleRevolutWebhook = exports.verifyPayment = exports.initiatePayment = void 0;
const axios_1 = __importDefault(require("axios"));
const payment_1 = __importDefault(require("../models/payment"));
const ride_1 = __importDefault(require("../models/ride"));
// Revolut API configuration
// Using your existing environment variables
const REVOLUT_API_URL = process.env.REVOLUT_MERCHANT_BASE_URL || 'https://merchant.revolut.com';
const REVOLUT_API_KEY = process.env.REVOLUT_MERCHANT_SECRET || '';
const REVOLUT_API_VERSION = process.env.REVOLUT_API_VERSION || '2024-09-01';
/**
 * Initiate payment with Revolut
 * Creates a payment order and returns the payment URL for webview
 */
const initiatePayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
        const { rideId, amount, currency = 'GBP' } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        console.log('=== INITIATE PAYMENT (Backend) ===');
        console.log('🆔 User ID from token:', userId);
        console.log('🚕 Ride ID:', rideId);
        console.log('💷 Amount:', amount);
        console.log('💵 Currency:', currency);
        if (!userId) {
            return res.status(401).json({
                status: false,
                message: 'Unauthorized'
            });
        }
        // Validate input
        if (!rideId || !amount) {
            return res.status(400).json({
                status: false,
                message: 'Missing required fields: rideId and amount'
            });
        }
        // Check if ride exists (don't populate to get raw ObjectId)
        const ride = yield ride_1.default.findById(rideId).select('+rider');
        if (!ride) {
            console.error('❌ Ride not found:', rideId);
            return res.status(404).json({
                status: false,
                message: 'Ride not found'
            });
        }
        console.log('✅ Ride found:', ride._id);
        console.log('👤 Ride rider (raw):', ride.rider);
        console.log('👤 Ride rider type:', typeof ride.rider);
        console.log('👤 Request user ID (raw):', userId);
        console.log('👤 Request user type:', typeof userId);
        // Extract ObjectId properly - handle both ObjectId and populated User objects
        const riderId = ride.rider;
        const riderIdString = (riderId === null || riderId === void 0 ? void 0 : riderId._id) ? riderId._id.toString() : riderId.toString();
        const userIdString = typeof userId === 'object' && (userId === null || userId === void 0 ? void 0 : userId._id)
            ? userId._id.toString()
            : userId.toString();
        console.log('🔍 Rider ID (string):', riderIdString);
        console.log('🔍 User ID (string):', userIdString);
        console.log('✔️  IDs match:', riderIdString === userIdString);
        // Check if user is the rider
        if (riderIdString !== userIdString) {
            console.error('❌ Authorization failed: User is not the rider');
            console.error('   Expected rider:', riderIdString);
            console.error('   Got user:', userIdString);
            return res.status(403).json({
                status: false,
                message: 'Not authorized to pay for this ride'
            });
        }
        console.log('✅ Authorization successful');
        // Create payment record
        const payment = new payment_1.default({
            ride: rideId,
            user: userId,
            amount: amount,
            currency: currency,
            paymentMethod: 'revolut',
            status: 'pending'
        });
        yield payment.save();
        // Create Revolut order
        try {
            const revolutResponse = yield axios_1.default.post(`${REVOLUT_API_URL}/api/orders`, {
                amount: Math.round(amount * 100), // Convert to cents
                currency: currency,
                merchant_order_ext_ref: String(payment._id),
                description: `Payment for ride #${rideId}`,
                customer_email: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.email) || undefined,
                settlement_currency: currency,
                metadata: {
                    rideId: rideId,
                    userId: String(userId),
                    paymentId: String(payment._id)
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${REVOLUT_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Revolut-Api-Version': REVOLUT_API_VERSION
                }
            });
            const { id: revolutOrderId, public_id, checkout_url } = revolutResponse.data;
            console.log('🔗 Revolut checkout URL received:', checkout_url);
            console.log('🔗 Checkout URL type:', typeof checkout_url);
            console.log('🔗 Checkout URL length:', checkout_url === null || checkout_url === void 0 ? void 0 : checkout_url.length);
            // Update payment with Revolut order details
            payment.revolutOrderId = revolutOrderId;
            payment.revolutPaymentUrl = checkout_url;
            payment.status = 'processing';
            yield payment.save();
            // Update ride with payment info
            ride.paymentStatus = 'processing';
            ride.paymentMethod = 'revolut';
            ride.paymentId = String(payment._id);
            ride.paymentUrl = checkout_url;
            ride.revolutOrderId = revolutOrderId;
            yield ride.save();
            console.log('');
            console.log('📤 ===== SENDING PAYMENT RESPONSE =====');
            console.log('📤 Payment ID:', payment._id);
            console.log('📤 Payment URL:', checkout_url);
            console.log('📤 Payment URL Type:', typeof checkout_url);
            console.log('📤 Response data:', {
                paymentId: payment._id,
                paymentUrl: checkout_url,
                revolutOrderId: revolutOrderId,
                publicId: public_id,
                amount: amount,
                currency: currency
            });
            console.log('=======================================');
            console.log('');
            return res.status(200).json({
                status: true,
                message: 'Payment initiated successfully',
                data: {
                    paymentId: payment._id,
                    paymentUrl: checkout_url,
                    revolutOrderId: revolutOrderId,
                    publicId: public_id,
                    amount: amount,
                    currency: currency
                }
            });
        }
        catch (revolutError) {
            console.error('Revolut API Error:', ((_c = revolutError.response) === null || _c === void 0 ? void 0 : _c.data) || revolutError.message);
            payment.status = 'failed';
            payment.errorMessage = ((_e = (_d = revolutError.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.message) || 'Failed to create Revolut order';
            yield payment.save();
            return res.status(500).json({
                status: false,
                message: 'Failed to initiate payment with Revolut',
                error: ((_f = revolutError.response) === null || _f === void 0 ? void 0 : _f.data) || revolutError.message
            });
        }
    }
    catch (error) {
        console.error('Error initiating payment:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});
exports.initiatePayment = initiatePayment;
/**
 * Verify payment status with Revolut
 * Called after payment webview is closed or from webhook
 */
const verifyPayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { paymentId } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        if (!userId) {
            return res.status(401).json({
                status: false,
                message: 'Unauthorized'
            });
        }
        // Find payment
        const payment = yield payment_1.default.findById(paymentId);
        if (!payment) {
            return res.status(404).json({
                status: false,
                message: 'Payment not found'
            });
        }
        // Check if user owns this payment
        if (payment.user.toString() !== String(userId)) {
            return res.status(403).json({
                status: false,
                message: 'Not authorized to access this payment'
            });
        }
        // If payment is already completed, return success
        if (payment.status === 'completed') {
            return res.status(200).json({
                status: true,
                message: 'Payment already completed',
                data: {
                    paymentId: payment._id,
                    status: payment.status,
                    amount: payment.amount,
                    currency: payment.currency
                }
            });
        }
        // Check status with Revolut
        try {
            const revolutResponse = yield axios_1.default.get(`${REVOLUT_API_URL}/api/orders/${payment.revolutOrderId}`, {
                headers: {
                    'Authorization': `Bearer ${REVOLUT_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Revolut-Api-Version': REVOLUT_API_VERSION
                }
            });
            const revolutOrder = revolutResponse.data;
            const revolutStatus = revolutOrder.state;
            // Map Revolut status to our payment status
            let newStatus = 'processing';
            if (revolutStatus === 'COMPLETED') {
                newStatus = 'completed';
                payment.completedAt = new Date();
                payment.transactionId = revolutOrder.id;
            }
            else if (revolutStatus === 'CANCELLED' || revolutStatus === 'FAILED') {
                newStatus = 'failed';
                payment.errorMessage = revolutOrder.cancel_reason || 'Payment failed';
            }
            else if (revolutStatus === 'PENDING' || revolutStatus === 'PROCESSING') {
                newStatus = 'processing';
            }
            payment.status = newStatus;
            payment.metadata = revolutOrder;
            yield payment.save();
            // Update ride payment status
            const ride = yield ride_1.default.findById(payment.ride);
            if (ride) {
                ride.paymentStatus = newStatus;
                yield ride.save();
            }
            return res.status(200).json({
                status: true,
                message: 'Payment status retrieved successfully',
                data: {
                    paymentId: payment._id,
                    status: payment.status,
                    amount: payment.amount,
                    currency: payment.currency,
                    revolutStatus: revolutStatus
                }
            });
        }
        catch (revolutError) {
            console.error('Revolut API Error:', ((_b = revolutError.response) === null || _b === void 0 ? void 0 : _b.data) || revolutError.message);
            return res.status(500).json({
                status: false,
                message: 'Failed to verify payment with Revolut',
                error: ((_c = revolutError.response) === null || _c === void 0 ? void 0 : _c.data) || revolutError.message
            });
        }
    }
    catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});
exports.verifyPayment = verifyPayment;
/**
 * Handle Revolut webhook callbacks
 * This endpoint receives payment status updates from Revolut
 */
const handleRevolutWebhook = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const webhookData = req.body;
        const { event, order } = webhookData;
        console.log('Revolut Webhook received:', event, order === null || order === void 0 ? void 0 : order.id);
        if (!order || !order.merchant_order_ext_ref) {
            return res.status(400).json({
                status: false,
                message: 'Invalid webhook data'
            });
        }
        // Find payment by merchant reference (payment ID)
        const payment = yield payment_1.default.findById(order.merchant_order_ext_ref);
        if (!payment) {
            console.error('Payment not found for webhook:', order.merchant_order_ext_ref);
            return res.status(404).json({
                status: false,
                message: 'Payment not found'
            });
        }
        // Update payment status based on webhook event
        let newStatus = payment.status;
        if (event === 'ORDER_COMPLETED' || order.state === 'COMPLETED') {
            newStatus = 'completed';
            payment.completedAt = new Date();
            payment.transactionId = order.id;
        }
        else if (event === 'ORDER_CANCELLED' || order.state === 'CANCELLED') {
            newStatus = 'failed';
            payment.errorMessage = order.cancel_reason || 'Payment cancelled';
        }
        else if (event === 'ORDER_AUTHORISED' || order.state === 'PROCESSING') {
            newStatus = 'processing';
        }
        payment.status = newStatus;
        payment.metadata = order;
        yield payment.save();
        // Update ride payment status
        const ride = yield ride_1.default.findById(payment.ride);
        if (ride) {
            ride.paymentStatus = newStatus;
            yield ride.save();
        }
        // Send success response to Revolut
        return res.status(200).json({
            status: true,
            message: 'Webhook processed successfully'
        });
    }
    catch (error) {
        console.error('Error handling Revolut webhook:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});
exports.handleRevolutWebhook = handleRevolutWebhook;
/**
 * Cancel payment
 */
const cancelPayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { paymentId } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        if (!userId) {
            return res.status(401).json({
                status: false,
                message: 'Unauthorized'
            });
        }
        const payment = yield payment_1.default.findById(paymentId);
        if (!payment) {
            return res.status(404).json({
                status: false,
                message: 'Payment not found'
            });
        }
        if (payment.user.toString() !== String(userId)) {
            return res.status(403).json({
                status: false,
                message: 'Not authorized to cancel this payment'
            });
        }
        if (payment.status === 'completed') {
            return res.status(400).json({
                status: false,
                message: 'Cannot cancel completed payment'
            });
        }
        payment.status = 'failed';
        payment.errorMessage = 'Cancelled by user';
        yield payment.save();
        // Update ride payment status
        const ride = yield ride_1.default.findById(payment.ride);
        if (ride) {
            ride.paymentStatus = 'failed';
            yield ride.save();
        }
        return res.status(200).json({
            status: true,
            message: 'Payment cancelled successfully'
        });
    }
    catch (error) {
        console.error('Error cancelling payment:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});
exports.cancelPayment = cancelPayment;
/**
 * Get payment details
 */
const getPaymentDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { paymentId } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        if (!userId) {
            return res.status(401).json({
                status: false,
                message: 'Unauthorized'
            });
        }
        const payment = yield payment_1.default.findById(paymentId).populate('ride').populate('user', 'fullName email phoneNumber');
        if (!payment) {
            return res.status(404).json({
                status: false,
                message: 'Payment not found'
            });
        }
        if (payment.user._id.toString() !== String(userId)) {
            return res.status(403).json({
                status: false,
                message: 'Not authorized to access this payment'
            });
        }
        return res.status(200).json({
            status: true,
            message: 'Payment details retrieved successfully',
            data: payment
        });
    }
    catch (error) {
        console.error('Error getting payment details:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});
exports.getPaymentDetails = getPaymentDetails;
