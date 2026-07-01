const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  specifications: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Technical specifications / hardware info'
  },
  condition: {
    type: DataTypes.ENUM('New', 'Used'),
    allowNull: false,
    defaultValue: 'New'
  },
  modelNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  categoryId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Searchable tags for indexing and filters'
  },
  attributes: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Custom attribute fields (e.g. edition, platform)'
  },
  dimensions: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: { length: 0, width: 0, height: 0 },
    comment: 'e.g. {length, width, height, unit}'
  },
  weight: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    defaultValue: 0.00,
    comment: 'Weight in kg/lbs'
  },
  isFeatured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isBestSeller: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isFlashSale: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Published', 'Hidden'),
    defaultValue: 'Draft'
  },
  vendorId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Reference to VendorProfile. Null means Admin'
  }
}, {
  indexes: [
    { fields: ['category_id'] },
    { fields: ['vendor_id'] },
    { fields: ['status'] },
    { fields: ['is_featured'] },
    { fields: ['is_best_seller'] },
    { fields: ['is_flash_sale'] }
  ]
});

module.exports = Product;
