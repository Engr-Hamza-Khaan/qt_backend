const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const ProductVariation = sequelize.define('ProductVariation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Unique SKU for inventory tracking'
  },
  color: {
    type: DataTypes.STRING,
    allowNull: true
  },
  storage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  edition: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'e.g. Standard, Digital, Collector\'s, Limited Edition'
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'e.g. PS5, PS4, Nintendo Switch, Xbox Series X, PC'
  },
  condition: {
    type: DataTypes.ENUM('New', 'Used'),
    allowNull: true,
    defaultValue: 'New',
    comment: 'Condition variation: New or Used'
  },
  bundle: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Bundle variation: e.g. Console Only, Console + Extra Controller, Game + Steelbook'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  costPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Cost price for accounting & profit calculations'
  },
  stockQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  lowStockThreshold: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Variation-specific title'
  },
  imageUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Variation-specific image URL'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  embedMedia: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  region: {
    type: DataTypes.STRING,
    allowNull: true
  },
  developer: {
    type: DataTypes.STRING,
    allowNull: true
  },
  brand: {
    type: DataTypes.STRING,
    allowNull: true
  },
  modelNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  storyHours: {
    type: DataTypes.STRING,
    allowNull: true
  },
  placement: {
    type: DataTypes.STRING,
    allowNull: true
  },
  maxPriceCap: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  genres: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  searchKeywords: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  attributes: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  indexes: [
    { fields: ['product_id'] },
    { fields: ['sku'] },
    { fields: ['price'] },
    { fields: ['platform'] },
    { fields: ['condition'] }
  ]
});

module.exports = ProductVariation;
