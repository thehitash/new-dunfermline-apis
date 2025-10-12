import { Socket } from 'socket.io';
import { JwtPayload } from 'jsonwebtoken';

/**
 * Extends the base Socket interface to include custom properties
 * like 'user' and 'activeRide' for better type safety throughout the application.
 */
export interface CustomSocket extends Socket {
    user?: JwtPayload & { id: string };
    activeRide?: string;
    startRide?: string;
} 