"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./api/routes/authRoutes"));
const driverRoutes_1 = __importDefault(require("./api/routes/driverRoutes"));
const rideRoutes_1 = __importDefault(require("./api/routes/rideRoutes"));
const chatRoutes_1 = __importDefault(require("./api/routes/chatRoutes"));
const notificationRoutes_1 = __importDefault(require("./api/routes/notificationRoutes"));
const vehicleRoutes_1 = __importDefault(require("./api/routes/vehicleRoutes"));
const paymentRoutes_1 = __importDefault(require("./api/routes/paymentRoutes"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./config/swagger");
const validateEnv_1 = require("./config/validateEnv");
require("./config/db");
const riderSocket_1 = __importDefault(require("./socket/riderSocket"));
// Load environment variables
dotenv_1.default.config();
// Validate environment variables before starting the server
(0, validateEnv_1.validateEnv)();
const app = (0, express_1.default)();
// Create HTTP server
const server = http_1.default.createServer(app);
// Initialize Socket.IO with our custom configuration and store the instance
const io = (0, riderSocket_1.default)(server);
// Make io accessible to our route handlers
app.set('io', io);
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
const PORT = process.env.PORT || 5001;
// Serve static files from views folder
app.use('/views', express_1.default.static(path_1.default.join(__dirname, 'views')));
// API Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/driver', driverRoutes_1.default);
app.use('/api/ride', rideRoutes_1.default);
app.use('/api/chat', chatRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/vehicles', vehicleRoutes_1.default);
app.use('/api/payment', paymentRoutes_1.default);
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec, swagger_1.swaggerUiOptions));
// Payment view routes (convenience routes)
app.get('/payment/success', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, 'views/revolut/payment-success.html'));
});
app.get('/payment/failed', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, 'views/revolut/payment-failed.html'));
});
app.get('/payment/processing', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, 'views/revolut/payment-processing.html'));
});
// Root route
app.get('/', (_req, res) => {
    res.send('Dunfermline Taxi Backend API');
});
server.listen(PORT, () => {
    console.log(`Server is running on port ${`http://localhost:${PORT}`}`);
});
