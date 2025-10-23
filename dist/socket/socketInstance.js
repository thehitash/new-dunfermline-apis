"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.init = void 0;
/**
 * This module allows sharing the Socket.IO instance across different parts of the application
 * Particularly useful for emitting events from controllers that don't have direct access to
 * the socket.io server instance
 */
let io = null;
/**
 * Store the io instance for later use
 * @param {Server} socketIo The Socket.IO server instance
 */
const init = (socketIo) => {
    io = socketIo;
    console.log('Socket.IO instance initialized and available globally');
};
exports.init = init;
/**
 * Get the io instance from anywhere in the app
 * @returns {Server | null} The Socket.IO server instance or null if not initialized
 */
const getIO = () => {
    if (!io) {
        console.warn('Socket.IO instance not initialized yet');
        return null;
    }
    return io;
};
exports.getIO = getIO;
