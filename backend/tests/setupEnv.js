// Runs before each test file's imports, so src/config/env.js sees these values.
process.env.NODE_ENV = 'test';
process.env.MONGO_URI ??= 'mongodb://placeholder/test'; // real URI is injected by globalSetup
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.CLINIC_TIMEZONE = 'Asia/Kolkata';
