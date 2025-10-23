"use strict";
/**
 * UK/Dunfermline Regional Configuration
 *
 * This file contains regional settings specific to the UK market
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhoneNumber = exports.formatPhoneNumber = exports.formatDistance = exports.formatCurrency = exports.regionalConfig = void 0;
exports.regionalConfig = {
    // Country Settings
    country: {
        code: process.env.COUNTRY_CODE || 'GB',
        name: 'United Kingdom',
        dialCode: '+44',
    },
    // Currency Settings
    currency: {
        code: process.env.CURRENCY || 'GBP',
        symbol: '£',
        name: 'British Pound Sterling',
    },
    // Locale Settings
    locale: process.env.LOCALE || 'en-GB',
    timezone: process.env.TIMEZONE || 'Europe/London',
    // Phone Number Format
    phoneNumber: {
        pattern: /^(\+44|0)[1-9]\d{8,10}$/,
        example: '07123456789 or +447123456789',
        description: 'UK mobile or landline number',
    },
    // Dunfermline Specific
    dunfermline: {
        location: {
            city: 'Dunfermline',
            region: 'Fife',
            country: 'Scotland',
            coordinates: {
                latitude: 56.0720,
                longitude: -3.4393,
            },
        },
        areaCode: '01383', // Dunfermline landline area code
    },
    // Distance & Speed Units (UK uses miles)
    units: {
        distance: 'miles',
        speed: 'mph',
        distanceAbbrev: 'mi',
        speedAbbrev: 'mph',
    },
    // Fare Calculations (example rates - adjust as needed)
    fares: {
        baseFare: 2.50, // £2.50 base fare
        perMile: 1.20, // £1.20 per mile
        perMinute: 0.25, // £0.25 per minute
        minimumFare: 4.00, // £4.00 minimum
        currency: 'GBP',
    },
    // Business Hours (24-hour format)
    businessHours: {
        start: '06:00',
        end: '23:00',
        timezone: 'Europe/London',
    },
    // SMS Settings
    sms: {
        sender: 'Dunfermline Taxi',
        templates: {
            otp: 'Your Dunfermline Taxi verification code is: {otp}. Valid for 5 minutes.',
            rideConfirmation: 'Your ride has been confirmed. Driver will arrive shortly.',
            rideComplete: 'Thank you for using Dunfermline Taxi! Fare: £{fare}',
        },
    },
};
// Helper function to format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat(exports.regionalConfig.locale, {
        style: 'currency',
        currency: exports.regionalConfig.currency.code,
    }).format(amount);
};
exports.formatCurrency = formatCurrency;
// Helper function to format distance
const formatDistance = (miles) => {
    return `${miles.toFixed(2)} ${exports.regionalConfig.units.distanceAbbrev}`;
};
exports.formatDistance = formatDistance;
// Helper function to format phone number for display
const formatPhoneNumber = (phone) => {
    // Remove +44 and replace with 0 for display
    if (phone.startsWith('+44')) {
        return '0' + phone.substring(3);
    }
    return phone;
};
exports.formatPhoneNumber = formatPhoneNumber;
// Helper function to normalize phone number for storage
const normalizePhoneNumber = (phone) => {
    // Remove spaces, dashes, and parentheses
    let normalized = phone.replace(/[\s\-()]/g, '');
    // If starts with 0, replace with +44
    if (normalized.startsWith('0')) {
        normalized = '+44' + normalized.substring(1);
    }
    // If doesn't start with +, add +44
    if (!normalized.startsWith('+')) {
        normalized = '+44' + normalized;
    }
    return normalized;
};
exports.normalizePhoneNumber = normalizePhoneNumber;
exports.default = exports.regionalConfig;
