"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiLimiter = exports.otpVerifyLimiter = exports.authLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Rate limiter for authentication endpoints (login, signup, OTP)
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
        status: false,
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip successful requests from counting toward the limit
    skipSuccessfulRequests: false,
});
// Rate limiter for OTP verification (stricter to prevent brute force)
exports.otpVerifyLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 OTP verification attempts per windowMs
    message: {
        message: 'Too many OTP verification attempts. Please try again after 15 minutes.',
        status: false,
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// General API rate limiter (more lenient)
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        message: 'Too many requests from this IP. Please try again later.',
        status: false,
    },
    standardHeaders: true,
    legacyHeaders: false,
});
