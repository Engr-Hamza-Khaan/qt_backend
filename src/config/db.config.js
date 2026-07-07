const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelizeOptions = {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: true // converts camelCase to snake_case in tables
  }
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
