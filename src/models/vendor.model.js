const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const VendorProfile = sequelize.define('VendorProfile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  contactPerson: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  balance: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
    allowNull: false,
    comment: 'Current balance owed to the vendor for sales'
  },
  pendingPayments: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
    allowNull: false,
    comment: 'Payments scheduled/pending'
  },
  paidPayments: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
    allowNull: false,
    comment: 'Total payments paid to date'
  },
  status: {
    type: DataTypes.ENUM('Active', 'Suspended', 'Pending Approval'),
    defaultValue: 'Pending Approval'
  }
});

module.exports = VendorProfile;
