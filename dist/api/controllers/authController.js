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
exports.verifyOTP = exports.sendOTP = exports.login = exports.signup = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_1 = __importDefault(require("../models/user"));
const otp_1 = __importDefault(require("../models/otp"));
const twilio_1 = __importDefault(require("twilio"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const twilioClient = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const generateToken = (id) => {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables');
    }
    return jsonwebtoken_1.default.sign({ id }, JWT_SECRET, {
        expiresIn: '7d', // Reduced from 30d for better security
    });
};
const signup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { fullName, email, phoneNumber, password, userType, carName, carNumber, carModel, carColor } = req.body;
    try {
        // Check if user exists with either email or phone number
        const emailExists = yield user_1.default.findOne({ email });
        const phoneExists = yield user_1.default.findOne({ phoneNumber });
        if (emailExists) {
            return res.status(400).json({
                message: 'This email is already registered. Please log in to continue.',
                status: false
            });
        }
        if (phoneExists) {
            return res.status(400).json({
                message: 'This phone number is already registered. Please log in to continue.',
                status: false
            });
        }
        const user = yield user_1.default.create(Object.assign({ fullName,
            email,
            phoneNumber,
            password,
            userType }, (userType === 'driver' && {
            carDetails: { carName, carNumber, carModel, carColor }
        })));
        if (user) {
            res.status(201).json({
                status: true,
                message: 'User registered successfully',
            });
        }
        else {
            res.status(400).json({ message: 'Invalid user data', status: false });
        }
    }
    catch (error) {
        if (error.code === 11000 && error.keyValue) {
            const field = Object.keys(error.keyValue)[0];
            const friendlyField = field === 'phoneNumber' ? 'phone number' : field;
            return res.status(400).json({
                message: `An account with this ${friendlyField} already exists.`,
                status: false
            });
        }
        console.log(error);
        res.status(500).json({ message: 'Server error', status: false });
    }
});
exports.signup = signup;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phoneNumber } = req.body;
    console.log("=== LOGIN REQUEST ===");
    console.log("📞 Phone Number:", phoneNumber);
    try {
        const user = yield user_1.default.findOne({ phoneNumber });
        console.log("👤 User Found:", user ? `Yes - ${user.fullName}` : "No");
        if (user) {
            // Generate random 6-digit OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            console.log("🔐 Generated OTP:", otp);
            console.log("⏰ OTP Expiry Time:", new Date(Date.now() + 5 * 60 * 1000).toLocaleString());
            // Delete any existing OTP for this phone number
            const deletedCount = yield otp_1.default.deleteMany({ phoneNumber });
            console.log("🗑️  Deleted old OTPs count:", deletedCount.deletedCount);
            // Store OTP in database with 5 minute expiration
            const otpRecord = yield otp_1.default.create({
                phoneNumber,
                otp,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
            });
            console.log("💾 OTP saved to database:", otpRecord._id);
            // Send OTP via Twilio SMS
            try {
                const message = yield twilioClient.messages.create({
                    body: `Your verification code is: ${otp}. This code will expire in 5 minutes.`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: phoneNumber,
                });
                console.log('✅ SMS sent successfully via Twilio');
                console.log('📨 Message SID:', message.sid);
                console.log('📱 Sent to:', phoneNumber);
                res.json(Object.assign({ status: true, message: 'OTP sent successfully' }, (process.env.NODE_ENV === 'development' && { otp })));
            }
            catch (twilioError) {
                console.error('❌ Twilio error:', twilioError.message);
                console.log('⚠️  Fallback: OTP generated but SMS not sent');
                console.log('🔐 OTP (for testing):', otp);
                res.json(Object.assign({ status: true, message: 'OTP sent successfully (SMS service unavailable)' }, (process.env.NODE_ENV === 'development' && { otp })));
            }
        }
        else {
            console.log("❌ User not found for phone:", phoneNumber);
            res.status(404).json({ message: "We couldn't find your account. Please sign up to get started!", status: false });
        }
    }
    catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Server error', status: false });
    }
});
exports.login = login;
const sendOTP = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phoneNumber } = req.body;
    console.log('=== SEND OTP REQUEST (RESEND) ===');
    console.log('📞 Phone Number:', phoneNumber);
    try {
        const user = yield user_1.default.findOne({ phoneNumber });
        if (!user) {
            console.log('❌ User not found:', phoneNumber);
            return res.status(404).json({ message: 'User not found for phone', status: false });
        }
        console.log('👤 User found:', user.fullName);
        // Generate random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log('🔐 Generated NEW OTP:', otp);
        console.log('⏰ OTP Expiry Time:', new Date(Date.now() + 5 * 60 * 1000).toLocaleString());
        // Delete any existing OTP for this phone number
        const deletedCount = yield otp_1.default.deleteMany({ phoneNumber });
        console.log('🗑️  Deleted old OTPs count:', deletedCount.deletedCount);
        // Store OTP in database with 5 minute expiration
        const otpRecord = yield otp_1.default.create({
            phoneNumber,
            otp,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        });
        console.log('💾 OTP saved to database:', otpRecord._id);
        // Send OTP via Twilio SMS
        try {
            const message = yield twilioClient.messages.create({
                body: `Your Dunfermline Taxi verification code is: ${otp}. Please use this code within 5 minutes to complete your booking.`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: phoneNumber,
            });
            console.log('✅ SMS sent successfully via Twilio');
            console.log('📨 Message SID:', message.sid);
            console.log('📱 Sent to:', phoneNumber);
            res.json(Object.assign({ message: 'OTP sent successfully', status: true }, (process.env.NODE_ENV === 'development' && { otp })));
        }
        catch (twilioError) {
            console.error('❌ Twilio error:', twilioError.message);
            console.log('⚠️  Fallback: OTP generated but SMS not sent');
            console.log('🔐 OTP (for testing):', otp);
            // Fallback: return OTP in response if SMS fails (for development)
            res.json(Object.assign({ message: 'OTP generated (SMS service unavailable)', status: true }, (process.env.NODE_ENV === 'development' && { otp })));
        }
    }
    catch (error) {
        console.error('❌ Server error:', error);
        res.status(500).json({ message: 'Server error', status: false });
    }
});
exports.sendOTP = sendOTP;
const verifyOTP = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phoneNumber, otp } = req.body;
    console.log('=== VERIFY OTP REQUEST ===');
    console.log('📞 Phone Number:', phoneNumber);
    console.log('🔐 Received OTP:', otp);
    try {
        const user = yield user_1.default.findOne({ phoneNumber });
        if (!user) {
            console.log('❌ User not found:', phoneNumber);
            return res.status(404).json({ message: 'User not found', status: false });
        }
        console.log('👤 User found:', user.fullName);
        // Find the most recent valid OTP for this phone number
        const storedOtpData = yield otp_1.default.findOne({
            phoneNumber,
            expiresAt: { $gt: new Date() }, // Not expired
        }).sort({ createdAt: -1 }); // Get the most recent one
        if (!storedOtpData) {
            console.log('❌ OTP not found or expired in database');
            console.log('⏰ Current time:', new Date().toLocaleString());
            return res.status(400).json({ message: 'OTP not found or expired', status: false });
        }
        console.log('💾 Found OTP in database:', storedOtpData.otp);
        console.log('⏰ OTP expires at:', storedOtpData.expiresAt.toLocaleString());
        console.log('🕐 Time remaining:', Math.floor((storedOtpData.expiresAt.getTime() - Date.now()) / 1000), 'seconds');
        // Verify the OTP
        if (otp === storedOtpData.otp) {
            console.log('✅ OTP MATCHED! Verification successful');
            // Clear the OTP after successful verification
            const deletedCount = yield otp_1.default.deleteMany({ phoneNumber });
            console.log('🗑️  Cleared OTPs count:', deletedCount.deletedCount);
            const token = generateToken(user._id);
            console.log('🎟️  Generated JWT token for user');
            res.json({
                message: 'OTP verified successfully',
                status: true,
                data: Object.assign(Object.assign({ _id: user._id, fullName: user.fullName, email: user.email, phoneNumber: user.phoneNumber, userType: user.userType }, (user.userType === 'driver' && {
                    carDetails: user.carDetails
                })), { token }),
            });
        }
        else {
            console.log('❌ OTP MISMATCH!');
            console.log('Expected:', storedOtpData.otp);
            console.log('Received:', otp);
            res.status(400).json({ message: 'Invalid OTP', status: false });
        }
    }
    catch (error) {
        console.error('❌ Verify OTP error:', error);
        res.status(500).json({ message: 'Server error', status: false });
    }
});
exports.verifyOTP = verifyOTP;
