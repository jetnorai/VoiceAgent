import 'dotenv/config';

// Use test database
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://adelbo:adelbo_dev@localhost:5432/adelbo_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-chars-long';
process.env.NODE_ENV = 'test';
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
process.env.WORLD_APP_ID = 'app_test';
process.env.ADMIN_API_KEY = 'test-admin-key';
