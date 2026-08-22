const crypto = require('crypto');
const { Op } = require('sequelize');
const { validateAndApplyCoupon } = require('../utils/discount.service');
const {
  sequelize,
  Product,
  ProductVariation,
  Category,
  Media,
  Order,
  OrderItem,
  User,
  WebsiteSetting,
  Page,
} = require('../models');

const sanitizeVariation = (v) => {
  const plain = v.toJSON ? v.toJSON() : v;
  const { costPrice, ...rest } = plain;
  return rest;
};

const sanitizeProduct = (product) => {
  const plain = product.toJSON ? product.toJSON() : product;
  if (plain.variations) {
    plain.variations = plain.variations
      .filter((v) => v.isActive)
      .map(sanitizeVariation);
  }
  return plain;
};

const generateOrderNumber = async () => {
  const latestOrder = await Order.findOne({ order: [['createdAt', 'DESC']] });
  if (!latestOrder) return 'QT-10001';
  const lastNum = parseInt(latestOrder.orderNumber.replace('QT-', ''), 10);
  return `QT-${lastNum + 1}`;
};

const findOrCreateGuestCustomer = async (guest, transaction) => {
  const { name, email, phoneNumber } = guest;
  let user = await User.findOne({ where: { email }, transaction });

  if (!user) {
    const randomPassword = crypto.randomBytes(16).toString('hex');
    user = await User.create(
      {
        name,
        email,
        password: randomPassword,
        role: 'Customer',
        phoneNumber: phoneNumber || null,
      },
      { transaction }
    );
  } else if (user.role !== 'Customer') {
    throw new Error('This email is associated with a non-customer account');
  } else if (!user.isActive) {
    throw new Error('This email account has been blocked from placing orders. Please contact customer support.');
  }

  return user;
};

// GET /api/store/home
const getHomeData = async (req, res, next) => {
  try {
    const [featured, bestSellers, flashSale, newArrivals, categories, bannersSetting, notificationSetting] =
      await Promise.all([
        Product.findAll({
          where: { status: 'Published', isFeatured: true },
          limit: 8,
          order: [['createdAt', 'DESC']],
          include: [
            { model: ProductVariation, as: 'variations', where: { isActive: true }, required: false },
            { model: Media, as: 'media' },
            { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'platform'] },
          ],
        }),
        Product.findAll({
          where: { status: 'Published', isBestSeller: true },
          limit: 8,
          order: [['createdAt', 'DESC']],
          include: [
            { model: ProductVariation, as: 'variations', where: { isActive: true }, required: false },
            { model: Media, as: 'media' },
            { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'platform'] },
          ],
        }),
        Product.findAll({
          where: { status: 'Published', isFlashSale: true },
          limit: 4,
          order: [['createdAt', 'DESC']],
          include: [
            { model: ProductVariation, as: 'variations', where: { isActive: true }, required: false },
            { model: Media, as: 'media' },
            { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'platform'] },
          ],
        }),
        Product.findAll({
          where: { status: 'Published' },
          limit: 10,
          order: [['createdAt', 'DESC']],
          include: [
            { model: ProductVariation, as: 'variations', where: { isActive: true }, required: false },
            { model: Media, as: 'media' },
            { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'platform'] },
          ],
        }),
        Category.findAll({
          where: { parentId: null },
          include: [{ model: Category, as: 'subcategories' }],
        }),
        WebsiteSetting.findOne({ where: { key: 'homepage_banners' } }),
        WebsiteSetting.findOne({ where: { key: 'notification_bar' } }),
      ]);

    res.json({
      success: true,
      data: {
        featured: featured.map(sanitizeProduct),
        bestSellers: bestSellers.map(sanitizeProduct),
        flashSale: flashSale.map(sanitizeProduct),
        newArrivals: newArrivals.map(sanitizeProduct),
        categories,
        settings: {
          banners: bannersSetting?.value || {},
          notification: {
            active: true,
            text: '🚚 Free shipping on orders over Rs 150! | Summer Sale Active Now!',
            link: '/shop',
            linkText: 'Shop Deals',
            preset: 'neon-purple',
            customBg: '#7c16c9',
            textColor: '#ffffff',
            dismissable: true,
            showInAdmin: true,
            icon: 'truck',
            placement: 'top',
            ...(notificationSetting?.value || {}),
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/store/products
const getStoreProducts = async (req, res, next) => {
  try {
    const {
      search,
      categoryId,
      categorySlug,
      platform,
      condition,
      minPrice,
      maxPrice,
      isFeatured,
      isBestSeller,
      isFlashSale,
      sortBy,
      order,
      page = 1,
      limit = 12,
    } = req.query;

    const where = { status: 'Published' };

    if (categorySlug) {
      const category = await Category.findOne({ where: { slug: categorySlug }, attributes: ['id'] });
      if (!category) {
        return res.json({
          success: true,
          count: 0,
          totalPages: 0,
          currentPage: parseInt(page, 10),
          data: [],
        });
      }
      where.categoryId = category.id;
    } else if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      const cleanSearch = search.trim();
      const [matchingCategories, matchingVariations] = await Promise.all([
        Category.findAll({
          where: {
            [Op.or]: [
              { name: { [Op.iLike]: `%${cleanSearch}%` } },
              { platform: { [Op.iLike]: `%${cleanSearch}%` } },
            ],
          },
          attributes: ['id'],
        }),
        ProductVariation.findAll({
          where: {
            isActive: true,
            [Op.or]: [
              { sku: { [Op.iLike]: `%${cleanSearch}%` } },
              { platform: { [Op.iLike]: `%${cleanSearch}%` } },
              { edition: { [Op.iLike]: `%${cleanSearch}%` } },
              { color: { [Op.iLike]: `%${cleanSearch}%` } },
              { storage: { [Op.iLike]: `%${cleanSearch}%` } },
              { bundle: { [Op.iLike]: `%${cleanSearch}%` } },
              { condition: { [Op.iLike]: `%${cleanSearch}%` } },
            ],
          },
          attributes: ['productId'],
        }),
      ]);

      const categoryIds = matchingCategories.map((c) => c.id);
      const variationProductIds = matchingVariations.map((v) => v.productId);

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
        sequelize.where(sequelize.cast(sequelize.col('Product.attributes'), 'text'), {
          [Op.iLike]: `%${cleanSearch}%`,
        }),
        ...(categoryIds.length ? [{ categoryId: { [Op.in]: categoryIds } }] : []),
        ...(variationProductIds.length ? [{ id: { [Op.in]: variationProductIds } }] : []),
      ];
    }
    if (condition) where.condition = condition;
    if (isFeatured === 'true') where.isFeatured = true;
    if (isBestSeller === 'true') where.isBestSeller = true;
    if (isFlashSale === 'true') where.isFlashSale = true;

    const hasMinPrice = minPrice !== undefined && minPrice !== '' && !isNaN(Number(minPrice));
    const hasMaxPrice = maxPrice !== undefined && maxPrice !== '' && !isNaN(Number(maxPrice));

    if (hasMinPrice || hasMaxPrice) {
      const priceFilter = {};
      if (hasMinPrice) priceFilter[Op.gte] = parseFloat(minPrice);
      if (hasMaxPrice) priceFilter[Op.lte] = parseFloat(maxPrice);

      const matchingPriceVariations = await ProductVariation.findAll({
        where: {
          isActive: true,
          price: priceFilter,
          ...(platform ? { platform } : {}),
        },
        attributes: ['productId'],
        raw: true,
      });

      const matchingProductIds = [...new Set(matchingPriceVariations.map((v) => v.productId))];

      if (where.id) {
        const prevId = where.id;
        delete where.id;
        where[Op.and] = [
          ...(where[Op.and] || []),
          { id: prevId },
          { id: { [Op.in]: matchingProductIds } },
        ];
      } else {
        where.id = { [Op.in]: matchingProductIds };
      }
    }

    let sortOrder = [['createdAt', 'DESC']];
    if (sortBy === 'price') {
      sortOrder = [[{ model: ProductVariation, as: 'variations' }, 'price', order === 'desc' ? 'DESC' : 'ASC']];
    } else if (sortBy) {
      sortOrder = [[sortBy, order === 'asc' ? 'ASC' : 'DESC']];
    }

    const queryLimit = parseInt(limit, 10);
    const queryOffset = (parseInt(page, 10) - 1) * queryLimit;

    const variationWhere = { isActive: true };
    if (platform) variationWhere.platform = platform;

    const { count, rows } = await Product.findAndCountAll({
      where,
      order: sortOrder,
      limit: queryLimit,
      offset: queryOffset,
      distinct: true,
      include: [
        { model: ProductVariation, as: 'variations', where: variationWhere, required: false },
        { model: Media, as: 'media' },
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'platform'] },
      ],
    });

    res.json({
      success: true,
      count,
      totalPages: Math.ceil(count / queryLimit),
      currentPage: parseInt(page, 10),
      data: rows.map(sanitizeProduct),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/store/products/:id
const getStoreProductById = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, status: 'Published' },
      include: [
        { model: ProductVariation, as: 'variations', where: { isActive: true }, required: false },
        { model: Media, as: 'media' },
        { model: Category, as: 'category' },
      ],
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: sanitizeProduct(product) });
  } catch (error) {
    next(error);
  }
};

// GET /api/store/pages/:slug
const getStorePage = async (req, res, next) => {
  try {
    const page = await Page.findOne({
      where: { slug: req.params.slug, status: 'Published' },
    });
    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }
    res.json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
};

// POST /api/store/checkout
const guestCheckout = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      items,
      guest,
      shippingAddress,
      billingAddress,
      paymentMethod,
      customerNotes,
      couponCode,
      discountAmount,
    } = req.body;

    if (!items?.length) {
      return res.status(400).json({ success: false, message: 'No items in cart' });
    }
    if (!guest?.name || !guest?.email) {
      return res.status(400).json({ success: false, message: 'Guest name and email are required' });
    }
    if (!shippingAddress) {
      return res.status(400).json({ success: false, message: 'Shipping address is required' });
    }

    const customer = await findOrCreateGuestCustomer(guest, transaction);
    const orderNumber = await generateOrderNumber();
    let totalAmount = 0;
    const parsedItems = [];

    for (const item of items) {
      const variation = await ProductVariation.findByPk(item.variationId, {
        include: [{ model: Product, as: 'product', where: { status: 'Published' } }],
        transaction,
      });

      if (!variation || !variation.isActive) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'One or more products are unavailable',
        });
      }

      if (variation.stockQuantity < item.quantity) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${variation.product.title}`,
        });
      }

      totalAmount += parseFloat(variation.price) * item.quantity;
      parsedItems.push({
        variationId: variation.id,
        quantity: item.quantity,
        price: variation.price,
        costPrice: null,
        vendorId: null,
        fulfillmentStatus: 'Unassigned',
      });
    }

    const finalDiscount = discountAmount ? parseFloat(discountAmount) : 0;
    let appliedCouponCode = couponCode || null;
    let validatedDiscount = finalDiscount;

    if (couponCode) {
      try {
        const couponResult = await validateAndApplyCoupon({
          code: couponCode,
          cartAmount: totalAmount,
          items,
        });
        validatedDiscount = couponResult.discountAmount;
        appliedCouponCode = couponResult.discount.code;
      } catch (couponError) {
        await transaction.rollback();
        return res.status(couponError.statusCode || 400).json({
          success: false,
          message: couponError.message,
        });
      }
    } else if (finalDiscount > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'A valid coupon code is required to apply a discount',
      });
    }

    const totalWithDiscount = Math.max(0, totalAmount - validatedDiscount);

    const order = await Order.create(
      {
        orderNumber,
        customerId: customer.id,
        totalAmount: totalWithDiscount,
        discountAmount: validatedDiscount,
        couponCode: appliedCouponCode,
        shippingAddress: { ...shippingAddress, guestEmail: guest.email, guestName: guest.name },
        billingAddress,
        paymentMethod: paymentMethod || 'Credit Card',
        customerNotes,
        paymentStatus: 'Pending',
        orderStatus: 'Pending',
      },
      { transaction }
    );

    for (const item of parsedItems) {
      await OrderItem.create({ orderId: order.id, ...item }, { transaction });
    }

    await transaction.commit();

    const fullOrder = await Order.findByPk(order.id, {
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: ProductVariation,
              as: 'variation',
              include: [{ model: Product, as: 'product', attributes: ['id', 'title'] }],
            },
          ],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        orderNumber: fullOrder.orderNumber,
        totalAmount: fullOrder.totalAmount,
        orderStatus: fullOrder.orderStatus,
        id: fullOrder.id,
      },
    });
  } catch (error) {
    await transaction.rollback();
    if (error.message?.includes('non-customer account') || error.message?.includes('blocked')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = {
  getHomeData,
  getStoreProducts,
  getStoreProductById,
  getStorePage,
  guestCheckout,
};
