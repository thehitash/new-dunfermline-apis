// ==============================
// 1. BACKEND SOCKET SETUP
// File: socket/riderSocket.ts
// ==============================

import { Server } from "socket.io";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Server as HttpServer } from 'http';
import Message from '../api/models/message';
import Ride from '../api/models/ride';
import notificationService from '../services/notificationService';

import { init } from "./socketInstance";
import { CustomSocket } from "./types";

function initializeSocket(server: HttpServer) {
    // Get CORS origin from environment or use default for development
    const corsOrigin = process.env.CORS_ORIGIN ||
        (process.env.NODE_ENV === 'production' ? false : '*');

    const io = new Server(server, {
        cors: {
            origin: corsOrigin,
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
            const JWT_SECRET = process.env.JWT_SECRET;

            if (!JWT_SECRET) {
                return next(new Error("JWT_SECRET not configured"));
            }

            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];
            if (!token) return next(new Error("Token not provided"));

            const decoded = jwt.verify(token, JWT_SECRET);

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
                    console.log("message sent to ride room", rideRoom);

                    // Send push notification to other users in the ride
                    try {
                        const ride = await Ride.findById(rideId)
                            .populate('rider', '_id fullName')
                            .populate('driver', '_id fullName');

                        if (ride) {
                            const senderName = (newMessage as any).user?.name || 'Someone';

                            // Determine who to send notification to (not the sender)
                            const recipientId = ride.rider._id.toString() === userId
                                ? ride.driver?._id.toString()
                                : ride.rider._id.toString();

                            if (recipientId && recipientId !== userId) {
                                await notificationService.sendToUser(
                                    recipientId,
                                    {
                                        title: `New message from ${senderName}`,
                                        body: text.length > 100 ? text.substring(0, 100) + '...' : text,
                                        data: {
                                            type: 'message',
                                            rideId: rideId,
                                            userName: senderName,
                                        }
                                    },
                                    {
                                        channelId: 'messages',
                                    }
                                );
                                console.log(`📩 Push notification sent to user ${recipientId}`);
                            }
                        }
                    } catch (notifErr) {
                        console.error('Error sending push notification:', notifErr);
                        // Don't fail the message send if notification fails
                    }
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
