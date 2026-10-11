const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const VendorStock = sequelize.define('VendorStock', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  vendorId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Vendor profile owning this stock'
  },
  variationId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Product SKU variation associated with this stock'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    },
    comment: 'Units of stock held by this vendor'
  },
  sellingPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'The selling price entered by the vendor'
  },
  vendorEarnings: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Amount vendor receives per unit (sellingPrice minus platform commission)'
  },
  commissionRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 10.00,
    comment: 'Platform commission percentage (default 10%)'
  }
}, {
  indexes: [
    { fields: ['vendor_id', 'variation_id'], unique: true },
    { fields: ['vendor_id'] },
    { fields: ['variation_id'] }
  ]
});

module.exports = VendorStock;
