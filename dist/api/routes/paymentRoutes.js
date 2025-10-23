"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const paymentController_1 = require("../controllers/paymentController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
// Protected routes (require authentication)
router.post('/initiate', authMiddleware_1.protect, paymentController_1.initiatePayment);
router.get('/verify/:paymentId', authMiddleware_1.protect, paymentController_1.verifyPayment);
router.post('/cancel/:paymentId', authMiddleware_1.protect, paymentController_1.cancelPayment);
router.get('/:paymentId', authMiddleware_1.protect, paymentController_1.getPaymentDetails);
// Webhook route (no auth required - Revolut will call this)
router.post('/webhook/revolut', paymentController_1.handleRevolutWebhook);
exports.default = router;
