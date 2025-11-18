/**
 * UK/Dunfermline Regional Configuration
 *
 * This file contains regional settings specific to the UK market
 */

export const regionalConfig = {
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
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat(regionalConfig.locale, {
    style: 'currency',
    currency: regionalConfig.currency.code,
  }).format(amount);
};

// Helper function to format distance
export const formatDistance = (miles: number): string => {
  return `${miles.toFixed(2)} ${regionalConfig.units.distanceAbbrev}`;
};

// Helper function to format phone number for display
export const formatPhoneNumber = (phone: string): string => {
  // Remove +44 and replace with 0 for display
  if (phone.startsWith('+44')) {
    return '0' + phone.substring(3);
  }
  return phone;
};

// Helper function to normalize phone number for storage
export const normalizePhoneNumber = (phone: string): string => {
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

export default regionalConfig;
