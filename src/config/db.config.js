const { Sequelize } = require('sequelize');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL || '';

// Determine if connecting to localhost or 127.0.0.1
const isLocalhost = 
  dbUrl.includes('localhost') || 
  dbUrl.includes('127.0.0.1') ||
  process.env.DB_HOST === 'localhost' || 
  process.env.DB_HOST === '127.0.0.1';

// Determine if SSL should be enabled:
// - Explicitly disabled if DB_SSL is 'false' or '0'
// - Explicitly enabled if DB_SSL is 'true' or '1'
// - Auto-detected: enabled in production for remote cloud DBs, disabled for localhost
let useSSL = false;
if (process.env.DB_SSL === 'false' || process.env.DB_SSL === '0') {
  useSSL = false;
} else if (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1') {
  useSSL = true;
} else if (dbUrl.includes('sslmode=require') || dbUrl.includes('ssl=true')) {
  useSSL = true;
} else if (isProduction && !isLocalhost) {
  useSSL = true;
}

const sequelizeOptions = {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: true // converts camelCase to snake_case in tables
  },
  ...(useSSL && {
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  })
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, sequelizeOptions)
  : new Sequelize(
    process.env.DB_NAME || 'qt_ecommerce',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || 'postgres',
    {
      ...sequelizeOptions,
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432
    }
  );

module.exports = sequelize;

