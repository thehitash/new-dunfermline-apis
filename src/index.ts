import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import { Request, Response } from 'express';
import authRoutes from './api/routes/authRoutes';
import driverRoutes from './api/routes/driverRoutes';
import rideRoutes from './api/routes/rideRoutes';
import chatRoutes from './api/routes/chatRoutes';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec, swaggerUiOptions } from './config/swagger';
import './config/db';
import initializeSocket from './socket/riderSocket';

dotenv.config();

const app = express();
// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with our custom configuration and store the instance
const io = initializeSocket(server);
// Make io accessible to our route handlers
app.set('io', io);

app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5001;



// Routes 
app.use('/api/auth', authRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/ride', rideRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

app.get('/', (req: Request, res: Response) => {
  res.send('Uber Clone Backend');
});


server.listen(PORT, () => {
  console.log(`Server is running on port ${`http://localhost:${PORT}`}`);
}); 