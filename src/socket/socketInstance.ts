import { Server } from 'socket.io';

/**
 * This module allows sharing the Socket.IO instance across different parts of the application
 * Particularly useful for emitting events from controllers that don't have direct access to
 * the socket.io server instance
 */

let io: Server | null = null;

/**
 * Store the io instance for later use
 * @param {Server} socketIo The Socket.IO server instance
 */
export const init = (socketIo: Server) => {
    io = socketIo;
    console.log('Socket.IO instance initialized and available globally');
};

/**
 * Get the io instance from anywhere in the app
 * @returns {Server | null} The Socket.IO server instance or null if not initialized
 */
export const getIO = (): Server | null => {
    if (!io) {
        console.warn('Socket.IO instance not initialized yet');
        return null;
    }
    return io;
}; 