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

    // Synchronize models (alter schema to match models safely)
    try {
      await sequelize.sync({ alter: true });
      console.log('Database tables synchronized successfully with alter.');
    } catch (alterErr) {
      console.warn('Sync alter notice (running safe column migration fallback):', alterErr.message);
      
      // Ensure missing tables are created first
      await sequelize.sync();

      // Safely check and add any missing columns across all models
      const queryInterface = sequelize.getQueryInterface();
      for (const modelName of Object.keys(sequelize.models)) {
        const model = sequelize.models[modelName];
        const tableName = model.getTableName();

        try {
          const tableDescription = await queryInterface.describeTable(tableName);
          const modelAttributes = model.rawAttributes;

          for (const [attrName, attrDef] of Object.entries(modelAttributes)) {
            const columnName = attrDef.field || attrName;
            if (!tableDescription[columnName]) {
              console.log(`Adding missing column "${columnName}" to table "${tableName}"...`);
              await queryInterface.addColumn(tableName, columnName, attrDef);
              console.log(`Successfully added column "${columnName}" to "${tableName}".`);
            }
          }
        } catch (tableErr) {
          console.warn(`Could not sync columns for table ${tableName}:`, tableErr.message);
        }
      }
      console.log('Safe database column migration completed successfully.');
    }

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
