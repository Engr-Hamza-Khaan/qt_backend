const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const InventoryMovement = sequelize.define('InventoryMovement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  variationId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  quantityChanged: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Positive for restock, negative for sales/deductions'
  },
  previousStock: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  newStock: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('Restock', 'Sale', 'Correction', 'Return', 'Supplier Allocation'),
    allowNull: false,
    defaultValue: 'Restock'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'The user (Admin or Vendor) who initiated the change'
  },
  vendorId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'The vendor profile associated with this inventory, if any'
  }
});

module.exports = InventoryMovement;
