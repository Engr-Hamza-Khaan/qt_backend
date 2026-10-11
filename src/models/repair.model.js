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
  deviceType: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Console',
    comment: 'Category of device e.g. Console, Controller, Handheld, Accessory'
  },
  deviceModel: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Model or brand e.g. PlayStation 5 Disc Edition, Xbox Series X, Switch OLED'
  },
  issueType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Primary defect category e.g. HDMI Port, Stick Drift, Power Issue'
  },
  serialNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Device serial number'
  },
  accessoriesIncluded: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Accessories shipped or dropped off'
  },
  preferredContact: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Email',
    comment: 'Preferred contact method: Email, Phone, WhatsApp'
  },
  priority: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Normal',
    comment: 'Urgency level: Low, Normal, Urgent'
  },
  estimatedCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0,
    comment: 'Estimated or quoted repair cost'
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
