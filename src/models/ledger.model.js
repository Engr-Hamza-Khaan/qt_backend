const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const SupplierLedger = sequelize.define('SupplierLedger', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  vendorId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('Sale Credit', 'Payout Debit', 'Refund Debit', 'Adjustment'),
    allowNull: false,
    comment: 'Sale Credit: earnings from a sold item. Payout Debit: payment/settlement paid to vendor'
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  balanceAfter: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: 'Vendor balance after this transaction'
  },
  referenceId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Can store Order ID or Payment Settlement ID'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

module.exports = SupplierLedger;
