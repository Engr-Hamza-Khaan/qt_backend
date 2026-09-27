const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  issueDate: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Pending', 'Paid', 'Cancelled', 'Overdue'),
    defaultValue: 'Pending',
    allowNull: false,
  },
  paymentMethod: {
    type: DataTypes.STRING,
    defaultValue: 'Cash on Delivery',
  },
  paymentStatus: {
    type: DataTypes.ENUM('Paid', 'Unpaid', 'Partially Paid'),
    defaultValue: 'Unpaid',
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  customerEmail: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customerPhone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customerAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  customerCity: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  companyName: {
    type: DataTypes.STRING,
    defaultValue: 'Quick Turn Gaming & Repairs',
  },
  companyLogo: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  companyAddress: {
    type: DataTypes.TEXT,
    defaultValue: 'Shop #12, Gaming Plaza, Saddar, Karachi, Pakistan',
  },
  companyPhone: {
    type: DataTypes.STRING,
    defaultValue: '+92 300 1234567',
  },
  companyEmail: {
    type: DataTypes.STRING,
    defaultValue: 'info@quickturn.pk',
  },
  companyWebsite: {
    type: DataTypes.STRING,
    defaultValue: 'www.quickturn.pk',
  },
  headerNote: {
    type: DataTypes.TEXT,
    defaultValue: 'Official Commercial Invoice & Warranty Receipt',
  },
  items: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    comment: 'Array of line items: [{ id, productId, variationId, title, sku, description, price, quantity, total }]',
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  discountAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  shippingFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  taxAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  footerNotes: {
    type: DataTypes.TEXT,
    defaultValue: 'Thank you for choosing Quick Turn! 7-day checking warranty on pre-owned items. For repairs, 30-day service warranty applies.',
  },
  paymentTerms: {
    type: DataTypes.TEXT,
    defaultValue: 'Payment Method: Cash / Bank Transfer. Bank: Meezan Bank | A/C Title: Quick Turn Store | A/C: 0101-01020304-01',
  },
  authorizedSignatory: {
    type: DataTypes.STRING,
    defaultValue: 'Quick Turn Store Manager',
  },
  showSignatureSection: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

module.exports = Invoice;
