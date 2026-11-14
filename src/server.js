const app = require('./app');
const { sequelize, User } = require('./models');
const seedDatabase = async () => {
  try {
    const seeder = require('./config/seeder');
    await seeder();
  } catch (error) {
    console.error('Failed to run seeder:', error);
  }
};

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Start HTTP server FIRST so Render detects the open port immediately
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    console.log(`📖 Swagger API Docs: http://localhost:${PORT}/api-docs`);
    console.log(`====================================================`);
  });

  try {
    console.log('Connecting to Redis...');
    // Verify the Redis connection (Redis is schemaless, so there is nothing to migrate or alter)
    await sequelize.authenticate();
    console.log('Redis connection has been established successfully.');

    // Auto-seed database if empty
    const userCount = await User.count();
    if (userCount === 0) {
      console.log('No users found in database. Auto-seeding initial data...');
      await seedDatabase();
    } else {
      console.log('Database already populated. Skipping seeding.');
    }

  } catch (error) {
    console.error('Unable to connect to Redis:', error);
    console.log('\n-------------------------------------------------------------');
    console.log('⚠️  DATABASE SETUP WARNING:');
    console.log('Please ensure REDIS_URL in .env points to your Vercel/Upstash Redis instance.');
    console.log('Example: REDIS_URL=rediss://default:<password>@<host>:<port>');
    console.log('-------------------------------------------------------------\n');
    // Do NOT exit — server is already listening on PORT
  }
};

startServer();
