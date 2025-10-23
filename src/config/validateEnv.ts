/**
 * Environment Variable Validation
 *
 * This module validates that all required environment variables are present
 * at application startup. Throws an error if any are missing.
 */

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'PORT',
];

const optionalEnvVars = [
  'NODE_ENV',
  'CORS_ORIGIN',
];

export function validateEnv(): void {
  const missingVars: string[] = [];

  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate JWT_SECRET is not the default value
  if (process.env.JWT_SECRET === 'your_jwt_secret' ||
      process.env.JWT_SECRET === 'your_jwt_secret_key_here' ||
      process.env.JWT_SECRET?.includes('CHANGE_THIS')) {
    console.warn('⚠️  WARNING: You are using a default JWT_SECRET. Please generate a strong random secret for production!');
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot use default JWT_SECRET in production environment');
    }
  }

  console.log('✅ All required environment variables are present');
}
