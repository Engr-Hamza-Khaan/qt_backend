const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Discount = sequelize.define('Discount', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'e.g. Black Friday Sale, Welcome Coupon'
  },
  code: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: 'Coupon code, if applicable. Null for auto-applied campaigns'
  },
  type: {
    type: DataTypes.ENUM('Percentage', 'Fixed Amount'),
    allowNull: false,
    defaultValue: 'Percentage'
  },
  value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'e.g. 15.00 for 15% or $15'
  },
  applyTo: {
    type: DataTypes.ENUM('All', 'Category', 'Product', 'Variation'),
    allowNull: false,
    defaultValue: 'All'
  },
  targetId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID of Category, Product, or Variation to target'
  },
  minPurchaseAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    allowNull: false
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

module.exports = Discount;
