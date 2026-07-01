const { Op } = require('sequelize');
const { sequelize, Product, ProductVariation, Category, Media, InventoryMovement, VendorProfile } = require('../models');

// Helper to generate SKU: "QT-PLAT-COND-ID-RAND"
const generateSKU = (platform, condition, title) => {
  const platCode = (platform || 'GEN').substring(0, 3).toUpperCase();
  const condCode = (condition || 'NEW').substring(0, 3).toUpperCase();
  const titleSlug = (title || 'PROD').substring(0, 3).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${platCode}-${condCode}-${titleSlug}-${randomPart}`;
};

// ==========================================
// CATEGORY CONTROLLERS
// ==========================================

const createCategory = async (req, res, next) => {
  try {
    const { name, slug, parentId, platform, description } = req.body;
    const category = await Category.create({ name, slug, parentId, platform, description });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    await category.update(req.body);
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    await category.destroy();
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      where: { parentId: null },
      include: [
        {
          model: Category,
          as: 'subcategories',
          include: [{ model: Category, as: 'subcategories' }] // Support deep hierarchy
        }
      ]
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// PRODUCT CONTROLLERS
// ==========================================

const addProduct = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      title,
      description,
      specifications,
      condition,
      modelNumber,
      categoryId,
      tags,
      attributes,
      dimensions,
      weight,
      isFeatured,
      isBestSeller,
      isFlashSale,
      status,
      variations // Array of variations
    } = req.body;

    // Check if role is Vendor, force product vendorId
    let vendorId = null;
    if (req.user.role === 'Vendor') {
      if (!req.user.vendorProfile) {
        return res.status(400).json({ success: false, message: 'Vendor profile not approved or missing' });
      }
      vendorId = req.user.vendorProfile.id;
    } else if (req.body.vendorId) {
      // Admins can create products and assign them to specific vendors
      vendorId = req.body.vendorId;
    }

    const product = await Product.create({
      title,
      description,
      specifications,
      condition,
      modelNumber,
      categoryId,
      tags: tags || [],
      attributes,
      dimensions,
      weight,
      isFeatured: isFeatured || false,
      isBestSeller: isBestSeller || false,
      isFlashSale: isFlashSale || false,
      status: status || 'Draft',
      vendorId
    }, { transaction });

    // Handle variations if provided
    if (variations && Array.isArray(variations)) {
      for (const val of variations) {
        const generatedSku = val.sku || generateSKU(val.platform || attributes.platform || 'GEN', condition, title);
        const variation = await ProductVariation.create({
          productId: product.id,
          sku: generatedSku,
          color: val.color,
          storage: val.storage,
          edition: val.edition,
          platform: val.platform || attributes.platform,
          price: val.price,
          costPrice: val.costPrice || 0,
          stockQuantity: val.stockQuantity || 0,
          lowStockThreshold: val.lowStockThreshold || 5,
          isActive: val.isActive !== undefined ? val.isActive : true
        }, { transaction });

        // Record initial inventory movement
        if (variation.stockQuantity > 0) {
          await InventoryMovement.create({
            variationId: variation.id,
            quantityChanged: variation.stockQuantity,
            previousStock: 0,
            newStock: variation.stockQuantity,
            type: 'Restock',
            notes: 'Initial stock load upon product creation',
            userId: req.user.id,
            vendorId: vendorId
          }, { transaction });
        }
      }
    }

    await transaction.commit();

    const fullProduct = await Product.findByPk(product.id, {
      include: [
        { model: ProductVariation, as: 'variations' },
        { model: Media, as: 'media' },
        { model: Category, as: 'category' }
      ]
    });

    res.status(201).json({ success: true, data: fullProduct });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const editProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Vendor restrictions
    if (req.user.role === 'Vendor' && product.vendorId !== req.user.vendorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this product' });
    }

    await product.update(req.body);
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Vendor restrictions
    if (req.user.role === 'Vendor' && product.vendorId !== req.user.vendorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this product' });
    }

    await product.destroy();
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const duplicateProduct = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const original = await Product.findByPk(id, {
      include: [
        { model: ProductVariation, as: 'variations' },
        { model: Media, as: 'media' }
      ]
    });

    if (!original) return res.status(404).json({ success: false, message: 'Original product not found' });

    // Vendor restrictions
    if (req.user.role === 'Vendor' && original.vendorId !== req.user.vendorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to duplicate this product' });
    }

    // Clone product
    const clonedProduct = await Product.create({
      title: `Copy of ${original.title}`,
      description: original.description,
      specifications: original.specifications,
      condition: original.condition,
      modelNumber: original.modelNumber,
      categoryId: original.categoryId,
      tags: original.tags,
      attributes: original.attributes,
      dimensions: original.dimensions,
      weight: original.weight,
      isFeatured: original.isFeatured,
      isBestSeller: original.isBestSeller,
      isFlashSale: original.isFlashSale,
      status: 'Draft', // default cloned to draft
      vendorId: original.vendorId
    }, { transaction });

    // Clone variations with new unique SKUs
    for (const v of original.variations) {
      const newSku = generateSKU(v.platform, original.condition, clonedProduct.title);
      await ProductVariation.create({
        productId: clonedProduct.id,
        sku: newSku,
        color: v.color,
        storage: v.storage,
        edition: v.edition,
        platform: v.platform,
        price: v.price,
        costPrice: v.costPrice,
        stockQuantity: 0, // Reset inventory for clone
        lowStockThreshold: v.lowStockThreshold,
        isActive: v.isActive
      }, { transaction });
    }

    // Clone media
    for (const m of original.media) {
      await Media.create({
        productId: clonedProduct.id,
        url: m.url,
        type: m.type,
        isFeatured: m.isFeatured,
        orderIndex: m.orderIndex
      }, { transaction });
    }

    await transaction.commit();

    const fullClone = await Product.findByPk(clonedProduct.id, {
      include: [
        { model: ProductVariation, as: 'variations' },
        { model: Media, as: 'media' }
      ]
    });

    res.status(201).json({ success: true, data: fullClone });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      categoryId,
      platform,
      condition,
      isFeatured,
      isBestSeller,
      isFlashSale,
      status,
      vendorId,
      lowStock,
      sortBy,
      order,
      page = 1,
      limit = 20
    } = req.query;

    const where = {};

    // Search filter
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Standard properties
    if (categoryId) where.categoryId = categoryId;
    if (condition) where.condition = condition;
    if (isFeatured !== undefined) where.isFeatured = isFeatured === 'true';
    if (isBestSeller !== undefined) where.isBestSeller = isBestSeller === 'true';
    if (isFlashSale !== undefined) where.isFlashSale = isFlashSale === 'true';
    if (status) where.status = status;

    // Platform (stored in attributes JSON)
    if (platform) {
      where['attributes.platform'] = platform;
    }

    // Vendor restrictions
    if (req.user.role === 'Vendor') {
      where.vendorId = req.user.vendorProfile.id;
    } else if (vendorId) {
      where.vendorId = vendorId;
    }

    // Sorting order
    let sortOrder = [['createdAt', 'DESC']];
    if (sortBy) {
      sortOrder = [[sortBy, order === 'asc' ? 'ASC' : 'DESC']];
    }

    // Variations include options
    const variationInclude = {
      model: ProductVariation,
      as: 'variations',
      where: {}
    };

    if (lowStock === 'true') {
      variationInclude.where.stockQuantity = {
        [Op.lte]: sequelize.col('variations.low_stock_threshold')
      };
    }

    // Calculate pagination values
    const queryLimit = parseInt(limit);
    const queryOffset = (parseInt(page) - 1) * queryLimit;

    // Perform findAndCountAll to return total count for pagination headers
    const { count, rows } = await Product.findAndCountAll({
      where,
      order: sortOrder,
      limit: queryLimit,
      offset: queryOffset,
      distinct: true, // ensures correct count when including relations
      include: [
        variationInclude,
        { model: Media, as: 'media' },
        { model: Category, as: 'category' },
        { model: VendorProfile, as: 'vendor', attributes: ['companyName'] }
      ]
    });

    res.json({
      success: true,
      count,
      totalPages: Math.ceil(count / queryLimit),
      currentPage: parseInt(page),
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id, {
      include: [
        { model: ProductVariation, as: 'variations' },
        { model: Media, as: 'media' },
        { model: Category, as: 'category' },
        { model: VendorProfile, as: 'vendor' }
      ]
    });

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Vendor restriction
    if (req.user.role === 'Vendor' && product.vendorId !== req.user.vendorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this product' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// VARIATION CONTROLLERS
// ==========================================

const addVariation = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { productId } = req.params;
    const { color, storage, edition, platform, price, costPrice, stockQuantity, sku, lowStockThreshold } = req.body;

    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Vendor checks
    if (req.user.role === 'Vendor' && product.vendorId !== req.user.vendorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit variations for this product' });
    }

    const finalSku = sku || generateSKU(platform || 'GEN', product.condition, product.title);

    const variation = await ProductVariation.create({
      productId,
      sku: finalSku,
      color,
      storage,
      edition,
      platform,
      price,
      costPrice: costPrice || 0,
      stockQuantity: stockQuantity || 0,
      lowStockThreshold: lowStockThreshold || 5
    }, { transaction });

    if (variation.stockQuantity > 0) {
      await InventoryMovement.create({
        variationId: variation.id,
        quantityChanged: variation.stockQuantity,
        previousStock: 0,
        newStock: variation.stockQuantity,
        type: 'Restock',
        notes: 'Initial variation stock load',
        userId: req.user.id,
        vendorId: product.vendorId
      }, { transaction });
    }

    await transaction.commit();
    res.status(201).json({ success: true, data: variation });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const updateVariation = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { variationId } = req.params;
    const { price, costPrice, stockQuantity, color, storage, edition, platform, sku, lowStockThreshold, isActive } = req.body;

    const variation = await ProductVariation.findByPk(variationId, {
      include: [{ model: Product, as: 'product' }]
    });

    if (!variation) return res.status(404).json({ success: false, message: 'Variation not found' });

    // Vendor checks
    if (req.user.role === 'Vendor' && variation.product.vendorId !== req.user.vendorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const prevStock = variation.stockQuantity;

    const updateFields = { price, costPrice, color, storage, edition, platform, sku, lowStockThreshold, isActive };
    if (stockQuantity !== undefined) {
      updateFields.stockQuantity = stockQuantity;
    }

    await variation.update(updateFields, { transaction });

    // Stock track movement
    if (stockQuantity !== undefined && stockQuantity !== prevStock) {
      await InventoryMovement.create({
        variationId: variation.id,
        quantityChanged: stockQuantity - prevStock,
        previousStock: prevStock,
        newStock: stockQuantity,
        type: 'Correction',
        notes: 'Manual inventory level correction',
        userId: req.user.id,
        vendorId: variation.product.vendorId
      }, { transaction });
    }

    await transaction.commit();
    res.json({ success: true, data: variation });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const deleteVariation = async (req, res, next) => {
  try {
    const { variationId } = req.params;
    const variation = await ProductVariation.findByPk(variationId, {
      include: [{ model: Product, as: 'product' }]
    });

    if (!variation) return res.status(404).json({ success: false, message: 'Variation not found' });

    // Vendor checks
    if (req.user.role === 'Vendor' && variation.product.vendorId !== req.user.vendorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await variation.destroy();
    res.json({ success: true, message: 'Variation deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// MEDIA CONTROLLERS
// ==========================================

const uploadProductMedia = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { type, isFeatured, orderIndex } = req.body;

    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Vendor restrictions
    if (req.user.role === 'Vendor' && product.vendorId !== req.user.vendorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No media file uploaded' });
    }

    // Local static path
    const fileUrl = `/uploads/${req.file.filename}`;

    // If setting featured, turn off other featured images for this product
    if (isFeatured === 'true') {
      await Media.update({ isFeatured: false }, { where: { productId } });
    }

    const media = await Media.create({
      productId,
      url: fileUrl,
      type: type || 'Image',
      isFeatured: isFeatured === 'true',
      orderIndex: orderIndex ? parseInt(orderIndex) : 0
    });

    res.status(201).json({ success: true, data: media });
  } catch (error) {
    next(error);
  }
};

const deleteMedia = async (req, res, next) => {
  try {
    const { mediaId } = req.params;
    const media = await Media.findByPk(mediaId, {
      include: [{ model: Product, as: 'product' }]
    });

    if (!media) return res.status(404).json({ success: false, message: 'Media file not found' });

    // Vendor restrictions
    if (req.user.role === 'Vendor' && media.product.vendorId !== req.user.vendorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Optionally delete from local filesystem
    const fs = require('fs');
    const path = require('path');
    const localFilePath = path.join(__dirname, '../../public', media.url);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    await media.destroy();
    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const reorderMedia = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { mediaOrders } = req.body; // Array: [{ id: mediaId, orderIndex: 0 }]

    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (req.user.role === 'Vendor' && product.vendorId !== req.user.vendorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    for (const item of mediaOrders) {
      await Media.update(
        { orderIndex: item.orderIndex },
        { where: { id: item.id, productId } }
      );
    }

    res.json({ success: true, message: 'Media order updated successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,

  addProduct,
  editProduct,
  deleteProduct,
  duplicateProduct,
  getProducts,
  getProductById,

  addVariation,
  updateVariation,
  deleteVariation,

  uploadProductMedia,
  deleteMedia,
  reorderMedia
};
