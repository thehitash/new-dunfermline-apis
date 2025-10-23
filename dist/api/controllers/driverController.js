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
exports.updateLocationBackground = exports.updateLocation = exports.getDriverStatus = void 0;
const user_1 = __importDefault(require("../models/user"));
const socketInstance_1 = require("../../socket/socketInstance");
const getDriverStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { driverId } = req.params;
    try {
        const driver = yield user_1.default.findById(driverId).select('-password');
        if (!driver || driver.userType !== 'driver') {
            return res.status(404).json({ message: 'Driver not found' });
        }
        if (!driver.location) {
            return res.status(404).json({ message: 'Driver location not found' });
        }
        res.status(200).json({
            data: {
                latitude: driver.location.coordinates[1],
                longitude: driver.location.coordinates[0],
                heading: driver.heading || 0, // Default to 0 if not set
            }
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
exports.getDriverStatus = getDriverStatus;
const updateLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { driverId, lat, lng, heading, rideId = null } = req.body;
    if (!driverId || !lat || !lng) {
        return res.status(400).json({ message: 'Driver ID and location are required' });
    }
    try {
        const driver = yield user_1.default.findById(driverId);
        if (!driver || driver.userType !== 'driver') {
            return res.status(404).json({ message: 'Driver not found' });
        }
        driver.location = {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
        };
        // Update heading separately if provided
        if (heading !== undefined && heading !== null) {
            driver.heading = parseFloat(heading);
        }
        const io = (0, socketInstance_1.getIO)();
        if (io && rideId) {
            const roomName = `ride_${rideId}`;
            io.to(roomName).emit('update_driver_location', {
                driverId,
                latitude: driver.location.coordinates[1],
                longitude: driver.location.coordinates[0],
                heading: driver.heading || 0,
            });
        }
        yield driver.save();
        res.status(200).json({ message: 'Location updated successfully' });
    }
    catch (error) {
        console.log("error", error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.updateLocation = updateLocation;
const updateLocationBackground = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { driverId, location, rideId = null } = req.body;
    const { coords } = location;
    const { latitude: lat, longitude: lng, heading } = coords;
    if (!driverId || !lat || !lng) {
        console.log("error++++");
        return res.status(400).json({ message: 'Driver ID and location are required' });
    }
    try {
        const driver = yield user_1.default.findById(driverId);
        if (!driver || driver.userType !== 'driver') {
            return res.status(404).json({ message: 'Driver not found' });
        }
        driver.location = {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
        };
        // Update heading separately if provided
        if (heading !== undefined && heading !== null) {
            driver.heading = parseFloat(heading);
        }
        const io = (0, socketInstance_1.getIO)();
        if (io && rideId) {
            console.log("emit ride to customer", rideId);
            const roomName = `ride_${rideId}`;
            io.to(roomName).emit('update_driver_location', {
                driverId,
                latitude: driver.location.coordinates[1],
                longitude: driver.location.coordinates[0],
                heading: driver.heading || 0,
            });
        }
        yield driver.save();
        res.status(200).json({ message: 'Location updated successfully' });
    }
    catch (error) {
        console.log("error", error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.updateLocationBackground = updateLocationBackground;
