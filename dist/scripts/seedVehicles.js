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
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const vehicle_1 = __importDefault(require("../api/models/vehicle"));
// Load environment variables
dotenv_1.default.config();
const vehicles = [
    {
        name: 'Comfort 4 Seater',
        type: 'comfort',
        capacity: 4,
        description: 'Comfortable sedan for up to 4 passengers with ample luggage space',
        baseFare: 9.00, // €9 for rides up to 3 miles
        baseMileageLimit: 3, // 3 miles included in base fare
        pricePerMileAfterBase: 3.00, // €3 per additional mile after 3 miles
        features: [
            'Air conditioning',
            'Comfortable seating',
            'Luggage space for 2-3 bags',
            'Professional driver',
            'GPS tracking'
        ],
        isActive: true
    },
    {
        name: 'Comfort 8 Seater',
        type: 'comfort',
        capacity: 8,
        description: 'Spacious minivan for up to 8 passengers, perfect for groups and families',
        baseFare: 9.00, // €9 for rides up to 3 miles
        baseMileageLimit: 3, // 3 miles included in base fare
        pricePerMileAfterBase: 3.00, // €3 per additional mile after 3 miles
        features: [
            'Air conditioning',
            'Extra spacious seating',
            'Large luggage capacity',
            'Professional driver',
            'GPS tracking',
            'Perfect for groups',
            'Family friendly'
        ],
        isActive: true
    }
];
const seedVehicles = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Connect to MongoDB
        const MONGODB_URI = process.env.MONGODB_URI;
        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }
        console.log('🔌 Connecting to MongoDB...');
        yield mongoose_1.default.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        // Clear existing vehicles
        console.log('🗑️  Clearing existing vehicles...');
        yield vehicle_1.default.deleteMany({});
        console.log('✅ Existing vehicles cleared');
        // Insert new vehicles
        console.log('📝 Seeding vehicles...');
        const createdVehicles = yield vehicle_1.default.insertMany(vehicles);
        console.log('✅ Successfully seeded vehicles:');
        createdVehicles.forEach((vehicle) => {
            console.log(`   - ${vehicle.name} (${vehicle.capacity} seats)`);
            console.log(`     Base fare: £${vehicle.baseFare} (up to ${vehicle.baseMileageLimit} miles)`);
            console.log(`     Additional: £${vehicle.pricePerMileAfterBase} per mile after ${vehicle.baseMileageLimit} miles`);
        });
        console.log('\n🎉 Seeding completed successfully!');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error seeding vehicles:', error);
        process.exit(1);
    }
});
// Run the seed function
seedVehicles();
