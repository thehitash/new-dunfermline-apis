import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { Request, Response } from 'express';
import authRoutes from './api/routes/authRoutes';
import driverRoutes from './api/routes/driverRoutes';
import rideRoutes from './api/routes/rideRoutes';
import chatRoutes from './api/routes/chatRoutes';
import notificationRoutes from './api/routes/notificationRoutes';
import vehicleRoutes from './api/routes/vehicleRoutes';
import paymentRoutes from './api/routes/paymentRoutes';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec, swaggerUiOptions } from './config/swagger';
import { validateEnv } from './config/validateEnv';
import './config/db';
import initializeSocket from './socket/riderSocket';

// Load environment variables
dotenv.config();

// Validate environment variables before starting the server
validateEnv();

const app = express();
// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with our custom configuration and store the instance
const io = initializeSocket(server);
// Make io accessible to our route handlers
app.set('io', io);

// CORS configuration - allow admin panel and mobile app
const allowedOrigins = [
  'http://localhost:5173',  // Admin panel (Vite default)
  'http://localhost:3000',  // Alternative admin panel port
  'http://localhost:5174',  // Alternative Vite port
  'http://localhost:19006', // Expo web
  'http://localhost:19000', // Expo mobile
];

// Add production origin if specified
if (process.env.CORS_ORIGIN) {
  allowedOrigins.push(process.env.CORS_ORIGIN);
}

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`⚠️ CORS blocked origin: ${origin}`);
      callback(null, true); // Allow anyway but log the warning
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

const PORT = process.env.PORT || 5001;

// Serve static files from views folder
app.use('/views', express.static(path.join(__dirname, 'views')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/ride', rideRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Payment view routes (convenience routes)
app.get('/payment/success', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'views/revolut/payment-success.html'));
});

app.get('/payment/failed', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'views/revolut/payment-failed.html'));
});

app.get('/payment/processing', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'views/revolut/payment-processing.html'));
});

// Root route
app.get('/', (_req: Request, res: Response) => {
  res.send('Dunfermline Taxi Backend API');
});


server.listen(PORT, () => {
  console.log(`Server is running on port ${`http://localhost:${PORT}`}`);
}); 