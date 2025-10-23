"use strict";
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
exports.getRideById = exports.pendingRides = exports.allRiderRides = exports.allDriverRides = exports.cancelRide = exports.acceptRejectRide = exports.requestRide = void 0;
const ride_1 = __importDefault(require("../models/ride"));
const user_1 = __importDefault(require("../models/user"));
const socketInstance_1 = require("../../socket/socketInstance");
const requestRide = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { pickup, destination, vehicleId, estimatedFare, scheduledTime } = req.body;
    console.log('=== REQUEST RIDE (Backend) ===');
    console.log('📍 Pickup:', pickup === null || pickup === void 0 ? void 0 : pickup.name);
    console.log('📍 Destination:', destination === null || destination === void 0 ? void 0 : destination.name);
    console.log('🚗 Vehicle ID:', vehicleId);
    console.log('💷 Estimated Fare:', estimatedFare);
    console.log('📅 Scheduled Time:', scheduledTime);
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    const riderId = req.user._id;
    if (!pickup || !destination) {
        return res.status(400).json({ message: 'Pickup and destination locations are required' });
    }
    // Validate scheduled time if provided
    if (scheduledTime) {
        const scheduledDate = new Date(scheduledTime);
        const now = new Date();
        const minimumTime = new Date(now.getTime() + 30 * 60000); // 30 minutes from now
        if (scheduledDate < minimumTime) {
            return res.status(400).json({ message: 'Scheduled time must be at least 30 minutes from now' });
        }
        const maxTime = new Date(now.getTime() + 7 * 24 * 60 * 60000); // 7 days
        if (scheduledDate > maxTime) {
            return res.status(400).json({ message: 'Scheduled time cannot be more than 7 days in the future' });
        }
    }
    try {
        const rideData = {
            rider: riderId,
            pickupLocation: {
                type: 'Point',
                coordinates: [pickup.longitude, pickup.latitude],
                address: pickup.description,
                place_id: pickup.place_id,
                name: pickup.name,
            },
            destinationLocation: {
                type: 'Point',
                coordinates: [destination.longitude, destination.latitude],
                address: destination.description,
                place_id: destination.place_id,
                name: destination.name,
            },
        };
        // Add optional fields if provided
        if (vehicleId) {
            rideData.vehicle = vehicleId;
        }
        if (estimatedFare) {
            rideData.estimatedFare = estimatedFare;
        }
        if (scheduledTime) {
            rideData.scheduledTime = new Date(scheduledTime);
            rideData.isScheduled = true;
        }
        const ride = yield ride_1.default.create(rideData);
        console.log('✅ Ride created successfully:', ride._id);
        // Find nearby drivers
        // const drivers = await User.find({
        //   location: {
        //     $near: {
        //       $geometry: {
        //         type: 'Point',
        //         coordinates: [pickup.longitude, pickup.latitude],
        //       },
        //       $maxDistance: 5000, // 5km
        //     },
        //   },
        //   userType: 'driver',
        // });
        const drivers = yield user_1.default.find({
            userType: 'driver',
        });
        console.log(`Found ${drivers.length} nearby drivers.`);
        const io = (0, socketInstance_1.getIO)();
        if (io) {
            io.emit('new_ride_request', ride);
        }
        // Emit ride request to nearby drivers
        // drivers.forEach(driver => {
        //   console.log(`Emitting rideRequest to driver: ${driver._id}`);
        //   const io = getIO();
        //   if (io) {
        //     io.to(driver._id as string).emit('rideRequest', ride);
        //   }
        // });
        res.status(201).json({ data: ride, status: true });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.requestRide = requestRide;
const acceptRejectRide = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { rideId, status } = req.body;
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    const driverId = req.user._id;
    try {
        const ride = yield ride_1.default.findById(rideId);
        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }
        // Check if the ride is already assigned to a driver
        if (ride.driver && ride.driver.toString() !== driverId.toString()) {
            return res.status(400).json({ message: 'Ride already accepted by another driver' });
        }
        // Validate status transitions
        const validStatuses = ['pending', 'accepted', 'ongoing', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        // Check if driver can change status based on current status
        if (ride.status === 'pending' && status !== 'accepted') {
            return res.status(400).json({ message: 'Can only accept pending rides' });
        }
        if (ride.status === 'accepted' && !['ongoing', 'cancelled'].includes(status)) {
            return res.status(400).json({ message: 'Accepted rides can only be changed to ongoing or cancelled' });
        }
        if (ride.status === 'ongoing' && status !== 'completed') {
            return res.status(400).json({ message: 'Ongoing rides can only be completed' });
        }
        if (ride.status === 'completed' || ride.status === 'cancelled') {
            return res.status(400).json({ message: 'Cannot change status of completed or cancelled rides' });
        }
        // Update ride
        ride.driver = driverId;
        ride.status = status;
        yield ride.save();
        const io = (0, socketInstance_1.getIO)();
        if (io) {
            const roomName = `ride_${rideId}`;
            io.to(roomName).emit('ride_update', { rideId });
        }
        res.status(200).json(ride);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
exports.acceptRejectRide = acceptRejectRide;
const cancelRide = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { rideId } = req.params;
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    const riderId = req.user._id;
    try {
        const ride = yield ride_1.default.findById(rideId);
        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }
        if (ride.rider.toString() !== riderId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to cancel this ride' });
        }
        if (ride.status !== 'pending' && ride.status !== 'accepted') {
            return res.status(400).json({ message: 'Ride cannot be cancelled at this stage' });
        }
        ride.status = 'cancelled';
        yield ride.save();
        res.status(200).json({ message: 'Ride cancelled successfully', status: true });
    }
    catch (error) {
        console.error("Error cancelling ride:", error);
        res.status(500).json({ message: 'Server error', status: false });
    }
});
exports.cancelRide = cancelRide;
const allDriverRides = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        console.error('❌ User not authenticated');
        return res.status(401).json({ message: 'Not authorized', status: false });
    }
    try {
        console.log('🔍 Fetching driver rides for:', req.user._id);
        const rides = yield ride_1.default.find({ driver: req.user._id })
            .populate('rider', 'fullName phoneNumber')
            .sort({ createdAt: -1 });
        console.log(`✅ Found ${rides.length} driver rides`);
        res.status(200).json({ data: rides, status: true });
    }
    catch (error) {
        console.error('❌ Error fetching driver rides:', error);
        res.status(500).json({ message: 'Server error', status: false });
    }
});
exports.allDriverRides = allDriverRides;
const allRiderRides = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { type, userType } = req.query;
    console.log('🔍 Fetching rides for user:', {
        userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id,
        type,
        userType,
        query: req.query
    });
    if (!req.user) {
        console.error('❌ User not authenticated');
        return res.status(401).json({ message: 'Not authorized', status: false });
    }
    let statusFilter = [];
    if (type === 'current') {
        statusFilter = ['pending', 'accepted', 'ongoing'];
    }
    else if (type === 'past') {
        statusFilter = ['completed', 'cancelled'];
    }
    else {
        // If no type specified, return all rides
        statusFilter = ['pending', 'accepted', 'ongoing', 'completed', 'cancelled'];
    }
    try {
        const userField = userType === 'driver' ? 'driver' : 'rider';
        const query = {
            [userField]: req.user._id,
            status: { $in: statusFilter }
        };
        console.log('📋 Query:', JSON.stringify(query));
        const rides = yield ride_1.default.find(query)
            .populate('driver', 'fullName profileImage rating carDetails')
            .populate('rider', 'fullName phoneNumber')
            .sort({ createdAt: -1 });
        console.log(`✅ Found ${rides.length} rides for ${userField}`);
        res.status(200).json({ data: rides, status: true });
    }
    catch (error) {
        console.error('❌ Error fetching rides:', error);
        res.status(500).json({ message: 'Server error', status: false });
    }
});
exports.allRiderRides = allRiderRides;
const pendingRides = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('🔍 Fetching pending rides');
        const rides = yield ride_1.default.find({ status: 'pending' })
            .populate('rider', 'fullName phoneNumber')
            .sort({ createdAt: -1 });
        console.log(`✅ Found ${rides.length} pending rides`);
        res.status(200).json({ data: rides, status: true });
    }
    catch (error) {
        console.error('❌ Error fetching pending rides:', error);
        res.status(500).json({ message: 'Server error', status: false });
    }
});
exports.pendingRides = pendingRides;
const getRideById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { rideId } = req.params;
    console.log('🔍 Fetching ride by ID:', rideId);
    try {
        const ride = yield ride_1.default.findById(rideId)
            .populate('rider', 'fullName phoneNumber')
            .populate('driver', 'fullName profileImage rating carDetails');
        if (!ride) {
            console.warn('⚠️  Ride not found:', rideId);
            return res.status(404).json({ message: 'Ride not found', status: false });
        }
        console.log('✅ Ride found:', ride._id);
        res.status(200).json({ data: ride, status: true });
    }
    catch (error) {
        console.error('❌ Error fetching ride:', error);
        res.status(500).json({ message: 'Server error', status: false });
    }
});
exports.getRideById = getRideById;
