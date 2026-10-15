const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const SellRequest = sequelize.define('SellRequest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Customer / Seller Info
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
  city: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Seller location / city e.g. Karachi, Lahore, Islamabad'
  },
  preferredContact: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'WhatsApp',
    comment: 'Preferred contact method: WhatsApp, Phone, Email'
  },

  // Category & Listing Type
  listingType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Used Console Ad',
    comment: 'Listing type: Used Console Ad, General Trade-In'
  },

  // Console Category Fields (matching Product / Console Category)
  productName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Hardware platform e.g. PS5, PS4, Xbox Series X/S, Nintendo Switch'
  },
  brand: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Sony',
    comment: 'Brand e.g. Sony, Microsoft, Nintendo'
  },
  variant: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Slim',
    comment: 'Variant e.g. Slim, Fat, Pro, Standard, Digital'
  },
  modelNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Hardware model number e.g. CFI-1200'
  },
  storage: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Storage size e.g. 500GB, 825GB, 1TB, 2TB'
  },
  color: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Color e.g. Glacier White, Midnight Black'
  },
  edition: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Disc Edition, Digital Edition, Special Edition, Standard'
  },
  placement: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Horizontal',
    comment: 'Horizontal, Vertical, Both'
  },
  condition: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Used',
    comment: 'Used - Like New, Used - Excellent, Used - Good, Used - Fair'
  },
  accessoriesIncluded: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Included controllers, cables, box, etc.'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Asking price for the used console ad'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  mediaUrls: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of item images or videos'
  },
  embedMedia: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'YouTube link or video demonstration'
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Searchable tags'
  },
  keywords: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Search keywords'
  },
  aliases: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Alternative names and nicknames'
  },

  // 30-Day Ad Lifecycle Management
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Ad expiration timestamp (auto-disables after 30 days)'
  },
  adStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Active',
    comment: 'Active, Expired, Disabled, Sold'
  },
  isAutoDisabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },

  // Internal Valuation / Admin Fields
  valuation: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Offered store valuation amount'
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
    defaultValue: 'Pending',
    allowNull: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Valuation details or reject explanations'
  }
});

module.exports = SellRequest;
