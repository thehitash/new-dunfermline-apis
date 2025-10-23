"use strict";
// ==============================
// 1. BACKEND SOCKET SETUP
// File: socket/riderSocket.ts
// ==============================
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
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const message_1 = __importDefault(require("../api/models/message"));
const socketInstance_1 = require("./socketInstance");
function initializeSocket(server) {
    // Get CORS origin from environment or use default for development
    const corsOrigin = process.env.CORS_ORIGIN ||
        (process.env.NODE_ENV === 'production' ? false : '*');
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: corsOrigin,
            methods: ["GET", "POST", "PUT", "DELETE"],
            allowedHeaders: ["Content-Type", "Authorization"],
            credentials: true,
        },
        transports: ["websocket", "polling"],
    });
    // Make the io instance available globally
    (0, socketInstance_1.init)(io);
    // Global error handler for the socket server
    io.engine.on("connection_error", (err) => {
        console.error("Socket.IO connection error:", err);
    });
    // Authentication Middleware
    io.use((socket, next) => {
        var _a;
        try {
            const JWT_SECRET = process.env.JWT_SECRET;
            if (!JWT_SECRET) {
                return next(new Error("JWT_SECRET not configured"));
            }
            const token = socket.handshake.auth.token || ((_a = socket.handshake.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1]);
            if (!token)
                return next(new Error("Token not provided"));
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            if (typeof decoded === 'string') {
                return next(new Error("Invalid token payload"));
            }
            socket.user = decoded;
            next();
        }
        catch (err) {
            console.error("Authentication error:", err.message);
            next(new Error("Authentication failed"));
        }
    });
    io.on("connection", (socket) => {
        var _a;
        try {
            const userId = (_a = socket.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                console.error("Socket connection missing user ID");
                socket.disconnect();
                return;
            }
            const userRoom = `user_${userId}`;
            socket.join(userRoom);
            console.log(`User connected: ${userId}`);
            socket.on("join_ride", (rideId) => {
                try {
                    if (!rideId) {
                        socket.emit("error", { message: "Invalid ride ID" });
                        return;
                    }
                    const roomName = `ride_${rideId}`;
                    socket.join(roomName);
                    socket.activeRide = rideId;
                    socket.emit("joined_ride", rideId);
                    console.log(`User ${userId} joined ${roomName}`);
                }
                catch (err) {
                    console.error("Error in join_ride:", err);
                    socket.emit("error", { message: "Failed to join ride" });
                }
            });
            socket.on("leave_ride", (rideId) => {
                try {
                    if (!rideId) {
                        socket.emit("error", { message: "Invalid ride ID" });
                        return;
                    }
                    const roomName = `ride_${rideId}`;
                    socket.leave(roomName);
                    console.log("User left room", roomName);
                    if (socket.activeRide === rideId)
                        delete socket.activeRide;
                    console.log(`User ${userId} left ${roomName}`);
                }
                catch (err) {
                    console.error("Error in leave_ride:", err);
                    socket.emit("error", { message: "Failed to leave ride" });
                }
            });
            socket.on("disconnect", () => {
                try {
                    console.log(`User disconnected: ${userId}`);
                }
                catch (err) {
                    console.error("Error in disconnect handler:", err);
                }
            });
            // Handle socket errors
            socket.on("error", (err) => {
                console.error("Socket error for user", userId, ":", err);
            });
            // --- CHAT SOCKET EVENTS ---
            socket.on('send_message', (data) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const { text, rideId } = data;
                    if (!text || !rideId) {
                        socket.emit('error', { message: 'text and rideId are required' });
                        return;
                    }
                    // Save message to DB
                    const newMessage = yield message_1.default.create({
                        user: userId,
                        ride: rideId,
                        text,
                    });
                    // Populate user field before emitting
                    yield newMessage.populate({
                        path: 'user',
                        select: 'fullName profileImage',
                        transform: (doc) => ({
                            _id: doc._id,
                            name: doc.fullName,
                            avatar: doc.profileImage
                        })
                    });
                    // Emit to all in the ride room
                    const rideRoom = `ride_${rideId}`;
                    io.to(rideRoom).emit('receive_message', newMessage);
                    console.log("message sent to ride room", rideRoom);
                }
                catch (err) {
                    console.error('Error in send_message:', err);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            }));
        }
        catch (err) {
            console.error("Error in connection handler:", err);
        }
    });
    return io;
}
exports.default = initializeSocket;
