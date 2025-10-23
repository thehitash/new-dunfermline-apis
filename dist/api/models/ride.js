"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const RideSchema = new mongoose_1.Schema({
    rider: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    driver: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    vehicle: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vehicle' },
    pickupLocation: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        address: { type: String, required: true },
        place_id: { type: String, required: true },
        name: { type: String, required: true },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    destinationLocation: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        address: { type: String, required: true },
        place_id: { type: String, required: true },
        name: { type: String, required: true },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    status: { type: String, enum: ['pending', 'accepted', 'ongoing', 'completed', 'cancelled'], default: 'pending' },
    fare: { type: Number },
    estimatedFare: { type: Number },
    scheduledTime: { type: Date },
    isScheduled: { type: Boolean, default: false },
    paymentStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'refunded'], default: 'pending' },
    paymentMethod: { type: String, enum: ['revolut', 'card', 'cash', 'wallet'] },
    paymentId: { type: String },
    paymentUrl: { type: String },
    revolutOrderId: { type: String }
}, { timestamps: true });
RideSchema.index({ pickupLocation: '2dsphere', destinationLocation: '2dsphere' });
exports.default = mongoose_1.default.model('Ride', RideSchema);
