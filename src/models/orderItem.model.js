const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  variationId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Selling price at the time of purchase'
  },
  costPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Cost price of the assigned vendor for profit/ledger calculations'
  },
  vendorId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Assigned supplier/vendor for fulfillment'
  },
  fulfillmentStatus: {
    type: DataTypes.ENUM('Unassigned', 'Assigned', 'Shipped', 'Delivered'),
    defaultValue: 'Unassigned',
    allowNull: false
  }
}, {
  indexes: [
    { fields: ['order_id'] },
    { fields: ['variation_id'] },
    { fields: ['vendor_id'] }
  ]
});

module.exports = OrderItem;
