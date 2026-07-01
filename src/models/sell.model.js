const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const SellRequest = sequelize.define('SellRequest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  customerEmail: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  customerPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  mediaUrls: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of item images or videos'
  },
  valuation: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Offered valuation amount'
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
    defaultValue: 'Pending',
    allowNull: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Valuation details or reject explanations'
  }
});

module.exports = SellRequest;
