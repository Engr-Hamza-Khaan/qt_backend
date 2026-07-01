const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  orderNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  taxAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  shippingAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  discountAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  couponCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  paymentStatus: {
    type: DataTypes.ENUM('Pending', 'Paid', 'Refunded'),
    defaultValue: 'Pending',
    allowNull: false
  },
  orderStatus: {
    type: DataTypes.ENUM('Pending', 'Processing', 'Supplier Assigned', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'),
    defaultValue: 'Pending',
    allowNull: false
  },
  shippingAddress: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'e.g. { street, city, state, postalCode, country, receiverName, receiverPhone }'
  },
  billingAddress: {
    type: DataTypes.JSON,
    allowNull: true
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Credit Card'
  },
  orderNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Internal notes visible to admins'
  },
  customerNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notes left by customer during checkout'
  },
  trackingNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  carrier: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  indexes: [
    { fields: ['customer_id'] },
    { fields: ['order_number'] },
    { fields: ['order_status'] },
    { fields: ['payment_status'] }
  ]
});

module.exports = Order;
