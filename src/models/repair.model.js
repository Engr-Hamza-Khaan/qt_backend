const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const RepairRequest = sequelize.define('RepairRequest', {
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
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  mediaUrls: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of image or video URLs'
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Processing', 'Completed', 'Archived'),
    defaultValue: 'Pending',
    allowNull: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Admin notes and action logs'
  }
});

module.exports = RepairRequest;
