const { Op } = require('../orm');
const { bestSellersByVariation, dailyTotals, fixed2 } = require('../utils/aggregates');
const { Order, OrderItem, ProductVariation, Product, Category, User, VendorProfile } = require('../models');

// @desc    Get dashboard metrics summary
// @route   GET /api/reports/dashboard
// @access  Private (Admin/Staff)
const getDashboardSummary = async (req, res, next) => {
  try {
    // 1. Core counters
    const totalRevenue = await Order.sum('totalAmount', { where: { paymentStatus: 'Paid' } }) || 0;
    const totalOrdersCount = await Order.count();
    const pendingOrdersCount = await Order.count({ where: { orderStatus: 'Pending' } });
    const returnedOrdersCount = await Order.count({ where: { orderStatus: 'Returned' } });
    const totalCustomersCount = await User.count({ where: { role: 'Customer' } });
    const totalVendorsCount = await VendorProfile.count({ where: { status: 'Active' } });

    // 2. Total products sold quantity (items that belong to paid orders)
    const paidOrders = await Order.findAll({ where: { paymentStatus: 'Paid' }, attributes: ['id'] });
    const paidOrderIds = paidOrders.map((o) => o.id);
    const totalProductsSold = await OrderItem.sum('quantity', {
      where: { orderId: { [Op.in]: paidOrderIds } }
    }) || 0;

    // 3. Recent orders
    const recentOrders = await Order.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'customer', attributes: ['name', 'email'] }]
    });

    // 4. Low stock alerts (where stock <= lowStockThreshold)
    const lowStockVariations = await ProductVariation.findAll({
      where: {
        stockQuantity: { [Op.lte]: { __t: 'col', name: 'low_stock_threshold' } },
        isActive: true
      },
      include: [{ model: Product, as: 'product', attributes: ['title'] }],
      limit: 10
    });

    // 5. Best selling products (grouped by variation/product)
    const paidItems = await OrderItem.findAll({
      where: { orderId: { [Op.in]: paidOrderIds } },
      include: [
        {
          model: ProductVariation,
          as: 'variation',
          include: [{ model: Product, as: 'product', attributes: ['title'] }]
        }
      ]
    });
    const bestSellers = bestSellersByVariation(paidItems, {
      valueKey: 'totalSales',
      valueOf: (item) => Number(item.quantity) * Number(item.price)
    });

    // 6. Sales trend (Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPaidOrders = await Order.findAll({
      where: {
        paymentStatus: 'Paid',
        createdAt: { [Op.gte]: thirtyDaysAgo }
      }
    });
    const salesTrend = dailyTotals(recentPaidOrders, {
      dateOf: (o) => o.createdAt,
      amountOf: (o) => o.totalAmount,
      amountKey: 'revenue',
      countKey: 'orders'
    });

    // 7. Inventory Overview
    const allVariations = await ProductVariation.findAll({ attributes: ['stockQuantity'] });
    const inventoryStats = [{
      totalStock: allVariations.length
        ? String(allVariations.reduce((sum, v) => sum + (Number(v.stockQuantity) || 0), 0))
        : null,
      totalSkus: String(allVariations.length)
    }];

    res.json({
      success: true,
      data: {
        cards: {
          totalRevenue: parseFloat(totalRevenue),
          totalOrders: totalOrdersCount,
          pendingOrders: pendingOrdersCount,
          returnedOrders: returnedOrdersCount,
          totalCustomers: totalCustomersCount,
          totalVendors: totalVendorsCount,
          totalProductsSold
        },
        recentOrders,
        lowStockAlerts: lowStockVariations,
        bestSellers,
        salesTrend,
        inventory: inventoryStats[0] || { totalStock: 0, totalSkus: 0 }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed financial reporting with filters
// @route   GET /api/reports/financial
// @access  Private (Admin/Staff)
const getFinancialReport = async (req, res, next) => {
  try {
    const { dateFrom, dateTo, categoryId, platform, vendorId } = req.query;

    const orderWhere = { paymentStatus: 'Paid' };
    const itemWhere = {};
    const productWhere = {};

    // Date range filter
    if (dateFrom && dateTo) {
      orderWhere.createdAt = {
        [Op.between]: [new Date(dateFrom), new Date(dateTo)]
      };
    }

    if (categoryId) productWhere.categoryId = categoryId;
    if (platform) productWhere.attributes = { platform };
    if (vendorId) itemWhere.vendorId = vendorId;

    // Fetch items matching filters
    const orderItems = await OrderItem.findAll({
      where: itemWhere,
      include: [
        {
          model: Order,
          as: 'order',
          where: orderWhere
        },
        {
          model: ProductVariation,
          as: 'variation',
          include: [
            {
              model: Product,
              as: 'product',
              where: productWhere,
              include: [{ model: Category, as: 'category' }]
            }
          ]
        }
      ]
    });

    // Calculations
    let grossRevenue = 0;
    let costOfGoods = 0; // COGS
    let totalDiscount = 0;
    const performanceByProduct = {};
    const performanceByCategory = {};

    for (const item of orderItems) {
      const revenue = parseFloat(item.price) * item.quantity;
      const cost = item.costPrice ? parseFloat(item.costPrice) * item.quantity : 0;
      const profit = revenue - cost;

      grossRevenue += revenue;
      costOfGoods += cost;

      // Group by Product
      const product = item.variation?.product;
      if (product) {
        if (!performanceByProduct[product.id]) {
          performanceByProduct[product.id] = {
            id: product.id,
            title: product.title,
            qtySold: 0,
            revenue: 0,
            cost: 0,
            profit: 0
          };
        }
        performanceByProduct[product.id].qtySold += item.quantity;
        performanceByProduct[product.id].revenue += revenue;
        performanceByProduct[product.id].cost += cost;
        performanceByProduct[product.id].profit += profit;

        // Group by Category
        const category = product.category;
        if (category) {
          if (!performanceByCategory[category.id]) {
            performanceByCategory[category.id] = {
              id: category.id,
              name: category.name,
              qtySold: 0,
              revenue: 0,
              cost: 0,
              profit: 0
            };
          }
          performanceByCategory[category.id].qtySold += item.quantity;
          performanceByCategory[category.id].revenue += revenue;
          performanceByCategory[category.id].cost += cost;
          performanceByCategory[category.id].profit += profit;
        }
      }
    }

    const netProfit = grossRevenue - costOfGoods;
    const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    res.json({
      success: true,
      data: {
        summary: {
          grossRevenue,
          costOfGoodsSold: costOfGoods,
          netProfit,
          profitMargin: parseFloat(profitMargin.toFixed(2))
        },
        productPerformance: Object.values(performanceByProduct),
        categoryPerformance: Object.values(performanceByCategory)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardSummary,
  getFinancialReport
};
