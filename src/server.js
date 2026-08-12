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
  try {
    console.log('Connecting to database...');
    // Authenticate Sequelize connection
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Synchronize models (alter schema to match models)
    await sequelize.sync({ alter: true }).catch((err) => {
      console.warn('Sync alter notice (falling back to standard sync):', err.message);
      return sequelize.sync();
    });
    console.log('Database tables synchronized successfully.');

    // Auto-seed database if empty
    const userCount = await User.count();
    if (userCount === 0) {
      console.log('No users found in database. Auto-seeding initial data...');
      await seedDatabase();
    } else {
      console.log('Database already populated. Skipping seeding.');
    }

    // Start listening
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      console.log(`📖 Swagger API Docs: http://localhost:${PORT}/api-docs`);
      console.log(`====================================================`);
    });

  } catch (error) {
    console.error('Unable to start the server due to database error:', error);
    
    // Fallback if Postgres fails connection and we want to allow testing server code
    console.log('\n-------------------------------------------------------------');
    console.log('⚠️  DATABASE SETUP WARNING:');
    console.log('Please ensure PostgreSQL is running and credentials in .env are correct.');
    console.log('You can configure the DB connection parameters inside the .env file.');
    console.log('-------------------------------------------------------------\n');
    
    process.exit(1);
  }
};

startServer();
