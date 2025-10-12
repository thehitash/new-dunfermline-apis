import 'socket.io';
import { JwtPayload } from 'jsonwebtoken';

declare module 'socket.io' {
  interface Socket {
    user?: (JwtPayload & { id: string });
    activeRide?: string;
  }
} 