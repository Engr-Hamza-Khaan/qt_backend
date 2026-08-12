const sequelize = require('../config/db.config');
const User = require('./user.model');
const VendorProfile = require('./vendor.model');
const Category = require('./category.model');
const Product = require('./product.model');
const ProductVariation = require('./variation.model');
const InventoryMovement = require('./inventory.model');
const Media = require('./media.model');
const Order = require('./order.model');
const OrderItem = require('./orderItem.model');
const SupplierLedger = require('./ledger.model');
const Page = require('./page.model');
const WebsiteSetting = require('./setting.model');
const Discount = require('./discount.model');
const RepairRequest = require('./repair.model');
const SellRequest = require('./sell.model');
const ChatConversation = require('./chat.model');
const SearchTerm = require('./searchTerm.model');

// Define Relationships

// User <-> VendorProfile (One-to-One)
User.hasOne(VendorProfile, { foreignKey: 'userId', as: 'vendorProfile', onDelete: 'CASCADE' });
VendorProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Category Hierarchy (Self-referencing parent-child)
Category.hasMany(Category, { foreignKey: 'parentId', as: 'subcategories', onDelete: 'SET NULL' });
Category.belongsTo(Category, { foreignKey: 'parentId', as: 'parentCategory' });

// Category <-> Product (One-to-Many)
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products', onDelete: 'SET NULL' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

// VendorProfile <-> Product (One-to-Many, optional - null means Admin product)
VendorProfile.hasMany(Product, { foreignKey: 'vendorId', as: 'products', onDelete: 'SET NULL' });
Product.belongsTo(VendorProfile, { foreignKey: 'vendorId', as: 'vendor' });

// Product <-> ProductVariation (One-to-Many)
Product.hasMany(ProductVariation, { foreignKey: 'productId', as: 'variations', onDelete: 'CASCADE' });
ProductVariation.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// Product <-> Media (One-to-Many)
Product.hasMany(Media, { foreignKey: 'productId', as: 'media', onDelete: 'CASCADE' });
Media.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// ProductVariation <-> InventoryMovement (One-to-Many)
ProductVariation.hasMany(InventoryMovement, { foreignKey: 'variationId', as: 'inventoryMovements', onDelete: 'CASCADE' });
InventoryMovement.belongsTo(ProductVariation, { foreignKey: 'variationId', as: 'variation' });

// VendorProfile <-> InventoryMovement (One-to-Many)
VendorProfile.hasMany(InventoryMovement, { foreignKey: 'vendorId', as: 'inventoryMovements', onDelete: 'SET NULL' });
InventoryMovement.belongsTo(VendorProfile, { foreignKey: 'vendorId', as: 'vendor' });

// User <-> Order (One-to-Many)
User.hasMany(Order, { foreignKey: 'customerId', as: 'orders', onDelete: 'RESTRICT' });
Order.belongsTo(User, { foreignKey: 'customerId', as: 'customer' });

// Order <-> OrderItem (One-to-Many)
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// ProductVariation <-> OrderItem (One-to-Many)
ProductVariation.hasMany(OrderItem, { foreignKey: 'variationId', as: 'orderItems', onDelete: 'RESTRICT' });
OrderItem.belongsTo(ProductVariation, { foreignKey: 'variationId', as: 'variation' });

// VendorProfile <-> OrderItem (One-to-Many, for supplier fulfillment tracking)
VendorProfile.hasMany(OrderItem, { foreignKey: 'vendorId', as: 'fulfilledItems', onDelete: 'SET NULL' });
OrderItem.belongsTo(VendorProfile, { foreignKey: 'vendorId', as: 'assignedVendor' });

// VendorProfile <-> SupplierLedger (One-to-Many)
VendorProfile.hasMany(SupplierLedger, { foreignKey: 'vendorId', as: 'ledgerEntries', onDelete: 'CASCADE' });
SupplierLedger.belongsTo(VendorProfile, { foreignKey: 'vendorId', as: 'vendor' });

// User (Staff/Admin) <-> ChatConversation (One-to-Many)
User.hasMany(ChatConversation, { foreignKey: 'assignedTo', as: 'assignedConversations', onDelete: 'SET NULL' });
ChatConversation.belongsTo(User, { foreignKey: 'assignedTo', as: 'agent' });

module.exports = {
  sequelize,
  User,
  VendorProfile,
  Category,
  Product,
  ProductVariation,
  InventoryMovement,
  Media,
  Order,
  OrderItem,
  SupplierLedger,
  Page,
  WebsiteSetting,
  Discount,
  RepairRequest,
  SellRequest,
  ChatConversation,
  SearchTerm
};
