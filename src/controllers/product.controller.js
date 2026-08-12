const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { uploadDir } = require('../middlewares/upload.middleware');
const { sequelize, Product, ProductVariation, Category, Media, InventoryMovement, VendorProfile } = require('../models');

// Helper to generate SKU: "QT-PLAT-COND-ID-RAND"
const generateSKU = (platform, condition, title, extra = '') => {
  const platCode = (platform || 'GEN').substring(0, 3).toUpperCase();
  const condCode = (condition || 'NEW').substring(0, 3).toUpperCase();
  const titleSlug = (title || 'PROD').substring(0, 3).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const extraCode = extra ? '-' + extra.substring(0, 4).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${platCode}-${condCode}-${titleSlug}${extraCode}-${randomPart}`;
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
      tags: Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      aliases: Array.isArray(req.body.aliases) ? req.body.aliases : typeof req.body.aliases === 'string' ? req.body.aliases.split(',').map((t) => t.trim()).filter(Boolean) : [],
      keywords: Array.isArray(req.body.keywords) ? req.body.keywords : typeof req.body.keywords === 'string' ? req.body.keywords.split(',').map((t) => t.trim()).filter(Boolean) : [],
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
        const varCondition = val.condition || condition || 'New';
        const generatedSku = val.sku || generateSKU(val.platform || attributes?.platform || 'GEN', varCondition, title, val.storage || val.color || val.edition || val.bundle);
        const variation = await ProductVariation.create({
          productId: product.id,
          sku: generatedSku,
          color: val.color || null,
          storage: val.storage || null,
          edition: val.edition || null,
          platform: val.platform || attributes?.platform || null,
          condition: varCondition,
          bundle: val.bundle || null,
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

    const updateData = { ...req.body };
    if (updateData.tags !== undefined) {
      updateData.tags = Array.isArray(updateData.tags)
        ? updateData.tags
        : typeof updateData.tags === 'string'
        ? updateData.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
    }
    if (updateData.aliases !== undefined) {
      updateData.aliases = Array.isArray(updateData.aliases)
        ? updateData.aliases
        : typeof updateData.aliases === 'string'
        ? updateData.aliases.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
    }
    if (updateData.keywords !== undefined) {
      updateData.keywords = Array.isArray(updateData.keywords)
        ? updateData.keywords
        : typeof updateData.keywords === 'string'
        ? updateData.keywords.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
    }

    await product.update(updateData);
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
      aliases: original.aliases || [],
      keywords: original.keywords || [],
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
      const newSku = generateSKU(v.platform, v.condition || original.condition, clonedProduct.title, v.storage || v.color || v.edition || v.bundle);
      await ProductVariation.create({
        productId: clonedProduct.id,
        sku: newSku,
        color: v.color,
        storage: v.storage,
        edition: v.edition,
        platform: v.platform,
        condition: v.condition || original.condition || 'New',
        bundle: v.bundle || null,
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
      const cleanSearch = search.trim();
      where[Op.or] = [
        { title: { [Op.iLike]: `%${cleanSearch}%` } },
        { description: { [Op.iLike]: `%${cleanSearch}%` } },
        { modelNumber: { [Op.iLike]: `%${cleanSearch}%` } },
        sequelize.where(sequelize.cast(sequelize.col('Product.aliases'), 'text'), {
          [Op.iLike]: `%${cleanSearch}%`,
        }),
        sequelize.where(sequelize.cast(sequelize.col('Product.keywords'), 'text'), {
          [Op.iLike]: `%${cleanSearch}%`,
        }),
        sequelize.where(sequelize.cast(sequelize.col('Product.tags'), 'text'), {
          [Op.iLike]: `%${cleanSearch}%`,
        }),
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
      required: false,
      separate: lowStock !== 'true',
    };

    if (lowStock === 'true') {
      variationInclude.where = {
        stockQuantity: {
          [Op.lte]: sequelize.col('variations.low_stock_threshold')
        }
      };
      variationInclude.required = true;
    }

    const mediaInclude = {
      model: Media,
      as: 'media',
      separate: true,
      order: [['orderIndex', 'ASC'], ['createdAt', 'ASC']],
    };

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
        mediaInclude,
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
        { model: Media, as: 'media', order: [['orderIndex', 'ASC'], ['createdAt', 'ASC']] },
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
    const { color, storage, edition, platform, condition, bundle, price, costPrice, stockQuantity, sku, lowStockThreshold, isActive } = req.body;

    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Vendor checks
    if (req.user.role === 'Vendor' && product.vendorId !== req.user.vendorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit variations for this product' });
    }

    const varCondition = condition || product.condition || 'New';
    const finalSku = sku || generateSKU(platform || product.attributes?.platform || 'GEN', varCondition, product.title, storage || color || edition || bundle);

    const variation = await ProductVariation.create({
      productId,
      sku: finalSku,
      color: color || null,
      storage: storage || null,
      edition: edition || null,
      platform: platform || product.attributes?.platform || null,
      condition: varCondition,
      bundle: bundle || null,
      price,
      costPrice: costPrice || 0,
      stockQuantity: stockQuantity || 0,
      lowStockThreshold: lowStockThreshold || 5,
      isActive: isActive !== undefined ? isActive : true
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
    const { price, costPrice, stockQuantity, color, storage, edition, platform, condition, bundle, sku, lowStockThreshold, isActive } = req.body;

    const variation = await ProductVariation.findByPk(variationId, {
      include: [{ model: Product, as: 'product' }]
    });

    if (!variation) return res.status(404).json({ success: false, message: 'Variation not found' });

    // Vendor checks
    if (req.user.role === 'Vendor' && variation.product.vendorId !== req.user.vendorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const prevStock = variation.stockQuantity;

    const updateFields = { price, costPrice, color, storage, edition, platform, condition, bundle, sku, lowStockThreshold, isActive };
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
    const existingMediaCount = await Media.count({ where: { productId } });
    const shouldFeature = isFeatured === 'true' || existingMediaCount === 0;

    if (shouldFeature) {
      await Media.update({ isFeatured: false }, { where: { productId } });
    }

    const media = await Media.create({
      productId,
      url: fileUrl,
      type: type || 'Image',
      isFeatured: shouldFeature,
      orderIndex: orderIndex ? parseInt(orderIndex) : existingMediaCount
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

    // Delete file from local filesystem
    const filename = path.basename(media.url);
    const localFilePath = path.join(uploadDir, filename);
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
