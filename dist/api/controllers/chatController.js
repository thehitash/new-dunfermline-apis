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
exports.getMessages = void 0;
const message_1 = __importDefault(require("../models/message"));
// Get chat messages between two users (optionally by ride)
const getMessages = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { rideId } = req.query;
    try {
        const messages = yield message_1.default.find({ ride: rideId })
            .populate({
            path: 'user',
            select: 'fullName profileImage',
            transform: (doc) => ({
                _id: doc._id,
                name: doc.fullName,
                avatar: doc.profileImage
            })
        })
            .sort({ createdAt: 1 });
        res.json({ messages });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
exports.getMessages = getMessages;
