// ==============================
// 1. BACKEND SOCKET SETUP
// File: socket/riderSocket.ts
// ==============================

import { Server } from "socket.io";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Server as HttpServer } from 'http';
import Message from '../api/models/message';

import { init } from "./socketInstance";
import { CustomSocket } from "./types";

function initializeSocket(server: HttpServer) {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PUT", "DELETE"],
            allowedHeaders: ["Content-Type", "Authorization"],
            credentials: true,
        },
        transports: ["websocket", "polling"],
    });

    // Make the io instance available globally
    init(io);

    // Global error handler for the socket server
    io.engine.on("connection_error", (err) => {
        console.error("Socket.IO connection error:", err);
    });

    // Authentication Middleware
    io.use((socket: CustomSocket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];
            if (!token) return next(new Error("Token not provided"));

            const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");

            if (typeof decoded === 'string') {
                return next(new Error("Invalid token payload"));
            }

            socket.user = decoded as JwtPayload & { id: string };
            next();
        } catch (err) {
            console.error("Authentication error:", (err as Error).message);
            next(new Error("Authentication failed"));
        }
    });

    io.on("connection", (socket: CustomSocket) => {
        try {
            const userId = socket.user?.id;
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
                } catch (err) {
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
                    if (socket.activeRide === rideId) delete socket.activeRide;
                    console.log(`User ${userId} left ${roomName}`);
                } catch (err) {
                    console.error("Error in leave_ride:", err);
                    socket.emit("error", { message: "Failed to leave ride" });
                }
            });

            socket.on("disconnect", () => {
                try {
                    console.log(`User disconnected: ${userId}`);
                } catch (err) {
                    console.error("Error in disconnect handler:", err);
                }
            });

            // Handle socket errors
            socket.on("error", (err) => {
                console.error("Socket error for user", userId, ":", err);
            });

            // --- CHAT SOCKET EVENTS ---
            socket.on('send_message', async (data) => {
                try {
                    const { text, rideId } = data;
                    if (!text || !rideId) {
                        socket.emit('error', { message: 'text and rideId are required' });
                        return;
                    }
                    // Save message to DB
                    const newMessage = await Message.create({
                        user: userId,
                        ride: rideId,
                        text,
                    });
                    // Populate user field before emitting
                    await newMessage.populate({
                        path: 'user',
                        select: 'fullName profileImage',
                        transform: (doc: any) => ({
                            _id: doc._id,
                            name: doc.fullName,
                            avatar: doc.profileImage
                        })
                    });
                    // Emit to all in the ride room
                    const rideRoom = `ride_${rideId}`;
                    io.to(rideRoom).emit('receive_message', newMessage);
                    console.log("message sent to ride room", rideRoom)
                } catch (err) {
                    console.error('Error in send_message:', err);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            });

        } catch (err) {
            console.error("Error in connection handler:", err);
        }
    });

    return io;
}

export default initializeSocket;
