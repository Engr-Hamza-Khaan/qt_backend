const { Op } = require('sequelize');
const {
  sequelize,
  User,
  VendorProfile,
  SupplierLedger,
  OrderItem,
  ProductVariation,
  Product,
  InventoryMovement,
  Order
} = require('../models');

// ==========================================
// ADMIN WORKFLOWS FOR VENDORS
// ==========================================

// @desc    Get all vendors/suppliers
// @route   GET /api/vendors
// @access  Private (Admin/Staff)
const getVendors = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const where = {};

    if (status) where.status = status;

    if (search) {
      where[Op.or] = [
        { companyName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const vendors = await VendorProfile.findAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'isActive'] }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, count: vendors.length, data: vendors });
  } catch (error) {
    next(error);
  }
};

// @desc    Get specific vendor details & ledger statements
// @route   GET /api/vendors/:id
// @access  Private (Admin/Staff/Vendor)
const getVendorById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Vendor restrictions
    if (req.user.role === 'Vendor' && req.user.vendorProfile.id !== id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view other vendor details' });
    }

    const vendor = await VendorProfile.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'isActive'] },
        { model: SupplierLedger, as: 'ledgerEntries', limit: 50, order: [['createdAt', 'DESC']] }
      ]
    });

    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    res.json({ success: true, data: vendor });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new vendor/supplier (Admin)
// @route   POST /api/vendors
// @access  Private (Admin/Super Admin)
const createVendor = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { name, email, password, phoneNumber, companyName, contactPerson, address, status } = req.body;

    if (!name || !email || !password || !companyName) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password and company name are required'
      });
    }

    const userExists = await User.findOne({ where: { email }, transaction });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'Vendor',
      phoneNumber: phoneNumber || null,
      isActive: true
    }, { transaction });

    const vendorProfile = await VendorProfile.create({
      userId: user.id,
      companyName,
      contactPerson: contactPerson || name,
      email,
      phone: phoneNumber || null,
      address: address || null,
      status: status || 'Active'
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: {
        ...vendorProfile.toJSON(),
        user: { id: user.id, name: user.name, isActive: user.isActive }
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Update a vendor details/status
// @route   PUT /api/vendors/:id
// @access  Private (Admin/Super Admin)
const updateVendor = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { companyName, contactPerson, email, phone, address, status, name, phoneNumber, isActive } = req.body;

    const vendor = await VendorProfile.findByPk(id, {
      include: [{ model: User, as: 'user' }],
      transaction
    });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const vendorUpdates = {};
    if (companyName !== undefined) vendorUpdates.companyName = companyName;
    if (contactPerson !== undefined) vendorUpdates.contactPerson = contactPerson;
    if (email !== undefined) vendorUpdates.email = email;
    if (phone !== undefined) vendorUpdates.phone = phone;
    if (address !== undefined) vendorUpdates.address = address;
    if (status !== undefined) vendorUpdates.status = status;

    if (Object.keys(vendorUpdates).length > 0) {
      await vendor.update(vendorUpdates, { transaction });
    }

    const userUpdates = {};
    if (name !== undefined) userUpdates.name = name;
    if (email !== undefined) userUpdates.email = email;
    if (phoneNumber !== undefined) userUpdates.phoneNumber = phoneNumber;
    else if (phone !== undefined) userUpdates.phoneNumber = phone;
    if (isActive !== undefined) userUpdates.isActive = isActive;

    if (Object.keys(userUpdates).length > 0) {
      await vendor.user.update(userUpdates, { transaction });
    }

    await transaction.commit();

    const updated = await VendorProfile.findByPk(id, {
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'isActive'] }]
    });

    res.json({ success: true, message: 'Vendor updated successfully', data: updated });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Delete a vendor/supplier
// @route   DELETE /api/vendors/:id
// @access  Private (Admin/Super Admin)
const deleteVendor = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const vendor = await VendorProfile.findByPk(id, { transaction });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    await User.destroy({ where: { id: vendor.userId }, transaction });

    await transaction.commit();
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Process a payment/payout settlement to a vendor
// @route   POST /api/vendors/:id/payouts
// @access  Private (Admin/Super Admin)
const settlePayout = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { amount, notes } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid payout amount required' });
    }

    const vendor = await VendorProfile.findByPk(id, { transaction });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const payoutVal = parseFloat(amount);
    if (parseFloat(vendor.balance) < payoutVal) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Owed balance: Rs ${vendor.balance}, attempting to pay: Rs ${payoutVal}`
      });
    }

    // Update balances
    const newBalance = parseFloat(vendor.balance) - payoutVal;
    vendor.balance = newBalance;
    vendor.paidPayments = parseFloat(vendor.paidPayments) + payoutVal;
    await vendor.save({ transaction });

    // Log Payout Debit
    const ledger = await SupplierLedger.create({
      vendorId: vendor.id,
      type: 'Payout Debit',
      amount: payoutVal,
      balanceAfter: newBalance,
      notes: notes || 'Settled vendor payment payout'
    }, { transaction });

    await transaction.commit();
    res.json({ success: true, message: 'Payout settled and ledger updated', data: ledger });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// ==========================================
// VENDOR PORTAL SPECIFIC ENDPOINTS
// ==========================================

// @desc    Get Vendor portal statistics with date range support
// @route   GET /api/vendors/portal/dashboard
// @access  Private (Vendor)
const getVendorDashboard = async (req, res, next) => {
  try {
    if (req.user.role !== 'Vendor' || !req.user.vendorProfile) {
      return res.status(403).json({ success: false, message: 'Access denied: Vendor role required' });
    }

    const vendorId = req.user.vendorProfile.id;
    const { startDate, endDate, dateFrom, dateTo, preset } = req.query;

    let fromDate = dateFrom || startDate;
    let toDate = dateTo || endDate;

    if (preset === 'today') {
      const now = new Date();
      fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (preset === '7d') {
      fromDate = new Date(new Date().setDate(new Date().getDate() - 7));
      toDate = new Date();
    } else if (preset === '30d') {
      fromDate = new Date(new Date().setDate(new Date().getDate() - 30));
      toDate = new Date();
    } else if (preset === 'this_month') {
      const now = new Date();
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      toDate = new Date();
    } else if (preset === 'this_year') {
      const now = new Date();
      fromDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      toDate = new Date();
    }

    const dateWhere = {};
    let parsedFrom = null;
    let parsedTo = null;

    if (fromDate) {
      if (fromDate instanceof Date) {
        parsedFrom = fromDate;
      } else if (typeof fromDate === 'string' && fromDate.length === 10) {
        parsedFrom = new Date(`${fromDate}T00:00:00.000Z`);
      } else {
        parsedFrom = new Date(fromDate);
      }
    }

    if (toDate) {
      if (toDate instanceof Date) {
        parsedTo = toDate;
      } else if (typeof toDate === 'string' && toDate.length === 10) {
        parsedTo = new Date(`${toDate}T23:59:59.999Z`);
      } else {
        parsedTo = new Date(toDate);
      }
    }

    // Safeguard: swap if parsedFrom > parsedTo
    if (parsedFrom && parsedTo && !isNaN(parsedFrom.getTime()) && !isNaN(parsedTo.getTime())) {
      if (parsedFrom > parsedTo) {
        const temp = parsedFrom;
        parsedFrom = parsedTo;
        parsedTo = temp;
      }
    }

    if (parsedFrom && !isNaN(parsedFrom.getTime())) {
      dateWhere[Op.gte] = parsedFrom;
    }
    if (parsedTo && !isNaN(parsedTo.getTime())) {
      dateWhere[Op.lte] = parsedTo;
    }

    const hasDateRange = Object.keys(dateWhere).length > 0 || Object.getOwnPropertySymbols(dateWhere).length > 0;

    const vendor = await VendorProfile.findByPk(vendorId, {
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
    });

    const [
      totalProducts,
      variations,
      earningsSum,
      paidSum,
      totalSold,
      monthlyEarnings,
      recentOrders,
      recentLedger,
      lowStockAlerts,
      bestSellers
    ] = await Promise.all([
      Product.count({ where: { vendorId } }),

      ProductVariation.findAll({
        include: [{
          model: Product,
          as: 'product',
          where: { vendorId },
          attributes: []
        }]
      }),

      SupplierLedger.sum('amount', {
        where: {
          vendorId,
          type: 'Sale Credit',
          ...(hasDateRange ? { createdAt: dateWhere } : {})
        }
      }),

      SupplierLedger.sum('amount', {
        where: {
          vendorId,
          type: 'Payout Debit',
          ...(hasDateRange ? { createdAt: dateWhere } : {})
        }
      }),

      OrderItem.sum('quantity', {
        where: {
          vendorId,
          ...(hasDateRange ? { createdAt: dateWhere } : {})
        }
      }),

      SupplierLedger.findAll({
        where: {
          vendorId,
          type: 'Sale Credit',
          ...(hasDateRange ? { createdAt: dateWhere } : {})
        },
        attributes: [
          [sequelize.fn('date_trunc', 'day', sequelize.col('created_at')), 'date'],
          [sequelize.fn('sum', sequelize.col('amount')), 'earnings']
        ],
        group: [sequelize.fn('date_trunc', 'day', sequelize.col('created_at'))],
        order: [[sequelize.fn('date_trunc', 'day', sequelize.col('created_at')), 'ASC']]
      }),

      Order.findAll({
        where: hasDateRange ? { createdAt: dateWhere } : {},
        order: [['createdAt', 'DESC']],
        limit: 10,
        include: [
          {
            model: OrderItem,
            as: 'items',
            where: { vendorId },
            required: true,
            include: [{
              model: ProductVariation,
              as: 'variation',
              include: [{ model: Product, as: 'product', attributes: ['title'] }]
            }]
          },
          {
            model: User,
            as: 'customer',
            attributes: ['id', 'name', 'email']
          }
        ]
      }),

      SupplierLedger.findAll({
        where: {
          vendorId,
          ...(hasDateRange ? { createdAt: dateWhere } : {})
        },
        order: [['createdAt', 'DESC']],
        limit: 10
      }),

      ProductVariation.findAll({
        where: {
          stockQuantity: { [Op.lte]: sequelize.col('low_stock_threshold') },
          isActive: true
        },
        include: [{
          model: Product,
          as: 'product',
          where: { vendorId },
          attributes: ['id', 'title']
        }],
        order: [['stockQuantity', 'ASC']],
        limit: 10
      }),

      OrderItem.findAll({
        attributes: [
          'variationId',
          [sequelize.fn('SUM', sequelize.col('OrderItem.quantity')), 'soldQuantity'],
          [sequelize.fn('SUM', sequelize.literal('"OrderItem"."quantity" * "OrderItem"."cost_price"')), 'totalEarnings']
        ],
        where: {
          vendorId,
          orderId: {
            [Op.in]: sequelize.literal(`(SELECT id FROM orders WHERE payment_status = 'Paid')`)
          },
          ...(hasDateRange ? { createdAt: dateWhere } : {})
        },
        include: [{
          model: ProductVariation,
          as: 'variation',
          include: [{ model: Product, as: 'product', attributes: ['title'] }]
        }],
        group: ['OrderItem.variation_id', 'variation.id', 'variation->product.id'],
        order: [[sequelize.literal('"soldQuantity"'), 'DESC']],
        limit: 5,
        subQuery: false
      })
    ]);

    const totalInventory = variations.reduce((sum, item) => sum + item.stockQuantity, 0);

    const mappedOrders = recentOrders.map((order) => {
      const vendorItems = order.items || [];
      const vendorSubtotal = vendorItems.reduce(
        (sum, item) => sum + parseFloat(item.costPrice || 0) * item.quantity,
        0
      );

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        customer: order.customer,
        vendorSubtotal,
        itemCount: vendorItems.length,
        items: vendorItems.map((item) => ({
          quantity: item.quantity,
          costPrice: item.costPrice,
          productTitle: item.variation?.product?.title,
          fulfillmentStatus: item.fulfillmentStatus
        }))
      };
    });

    res.json({
      success: true,
      data: {
        vendor: {
          id: vendor.id,
          companyName: vendor.companyName,
          status: vendor.status,
          contactPerson: vendor.contactPerson,
          user: vendor.user
        },
        summary: {
          totalProducts,
          totalInventory,
          totalSold: totalSold || 0,
          totalEarnings: parseFloat(earningsSum || 0),
          totalPaid: hasDateRange ? parseFloat(paidSum || 0) : parseFloat(vendor.paidPayments || 0),
          currentBalance: parseFloat(vendor.balance || 0)
        },
        monthlyTrends: monthlyEarnings,
        recentOrders: mappedOrders,
        recentLedger,
        lowStockAlerts,
        bestSellers
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  settlePayout,
  getVendorDashboard
};
