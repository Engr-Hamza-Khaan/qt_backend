const { Op } = require('../orm');
const { bestSellersByVariation, dailyTotals } = require('../utils/aggregates');
const {
  sequelize,
  User,
  VendorProfile,
  SupplierLedger,
  OrderItem,
  ProductVariation,
  Product,
  InventoryMovement,
  Order,
  VendorStock,
  Media,
  SellRequest
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
    const { companyName, contactPerson, email, phone, address, status, name, phoneNumber, isActive, password } = req.body;

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
    if (password && password.trim().length >= 6) userUpdates.password = password.trim();

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
      VendorStock.count({ where: { vendorId, quantity: { [Op.gt]: 0 } } }),

      VendorStock.findAll({
        where: { vendorId },
        include: [{
          model: ProductVariation,
          as: 'variation',
          include: [{ model: Product, as: 'product', attributes: ['id', 'title'] }]
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
        }
      }).then((rows) => dailyTotals(rows, {
        dateOf: (r) => r.createdAt,
        amountOf: (r) => r.amount,
        amountKey: 'earnings'
      })),

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

      VendorStock.findAll({
        where: {
          vendorId,
          quantity: { [Op.lte]: 5 }
        },
        include: [{
          model: ProductVariation,
          as: 'variation',
          include: [{ model: Product, as: 'product', attributes: ['id', 'title'] }]
        }],
        order: [['quantity', 'ASC']],
        limit: 10
      }),

      (async () => {
        const paidOrders = await Order.findAll({ where: { paymentStatus: 'Paid' }, attributes: ['id'] });
        const items = await OrderItem.findAll({
          where: {
            vendorId,
            orderId: { [Op.in]: paidOrders.map((o) => o.id) },
            ...(hasDateRange ? { createdAt: dateWhere } : {})
          },
          include: [{
            model: ProductVariation,
            as: 'variation',
            include: [{ model: Product, as: 'product', attributes: ['title'] }]
          }]
        });
        return bestSellersByVariation(items, {
          valueKey: 'totalEarnings',
          valueOf: (item) => (item.costPrice === null || item.costPrice === undefined
            ? null
            : Number(item.quantity) * Number(item.costPrice))
        });
      })()
    ]);

    const totalInventory = (variations || []).reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);

    const formattedLowStockAlerts = (lowStockAlerts || []).map((s) => ({
      id: s.id,
      sku: s.variation?.sku || 'SKU',
      stockQuantity: s.quantity,
      lowStockThreshold: s.variation?.lowStockThreshold || 5,
      product: s.variation?.product || { title: 'Unknown Product' }
    }));

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
        lowStockAlerts: formattedLowStockAlerts,
        bestSellers
      }
    });
  } catch (error) {
    next(error);
  }
};

const VENDOR_POLICY_NOTE = 'Payment will be cleared after product is successfully received by the customer. If product has any problem or is not as described, all delivery charges will be paid by the vendor. Product should meet all the given details.';

// @desc    Vendor Stock In for a selected product and SKU
// @route   POST /api/vendors/stock/in
// @access  Private (Vendor)
const vendorStockIn = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    if (req.user.role !== 'Vendor' || !req.user.vendorProfile) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Access denied: Vendor account required' });
    }

    const vendorId = req.user.vendorProfile.id;
    const { variationId, quantity, sellingPrice } = req.body;

    if (!variationId) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'SKU variation selection is required' });
    }

    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Please provide a valid stock quantity (minimum 1)' });
    }

    const price = parseFloat(sellingPrice);
    if (!price || price <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Please provide a valid selling price' });
    }

    // Find variation and its parent product
    const variation = await ProductVariation.findByPk(variationId, {
      include: [{ model: Product, as: 'product' }],
      transaction
    });

    if (!variation) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Selected SKU variation not found' });
    }

    // Check maxPriceCap if defined on variation or product
    const effectiveCap = variation.maxPriceCap !== null && variation.maxPriceCap !== undefined
      ? parseFloat(variation.maxPriceCap)
      : (variation.product?.maxPriceCap ? parseFloat(variation.product.maxPriceCap) : null);

    if (effectiveCap && price > effectiveCap) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Selling price (Rs ${price}) exceeds the maximum price cap (Rs ${effectiveCap}) set for this game.`
      });
    }

    // 10% platform fee calculation (e.g. 5k selling price -> 4.5k to vendor)
    const commissionRate = 10.0;
    const commissionFraction = commissionRate / 100.0;
    const commissionPerUnit = parseFloat((price * commissionFraction).toFixed(2));
    const vendorReceivesPerUnit = parseFloat((price - commissionPerUnit).toFixed(2));

    // Find or create VendorStock
    let vendorStock = await VendorStock.findOne({
      where: { vendorId, variationId },
      transaction
    });

    let previousVendorQty = 0;
    let newVendorQty = qty;

    if (vendorStock) {
      previousVendorQty = vendorStock.quantity;
      newVendorQty = previousVendorQty + qty;
      vendorStock.quantity = newVendorQty;
      vendorStock.sellingPrice = price;
      vendorStock.vendorEarnings = vendorReceivesPerUnit;
      vendorStock.commissionRate = commissionRate;
      await vendorStock.save({ transaction });
    } else {
      vendorStock = await VendorStock.create({
        vendorId,
        variationId,
        quantity: qty,
        sellingPrice: price,
        vendorEarnings: vendorReceivesPerUnit,
        commissionRate: commissionRate
      }, { transaction });
    }

    // Update global variation stock and cost price
    const prevGlobalStock = variation.stockQuantity;
    const newGlobalStock = prevGlobalStock + qty;
    variation.stockQuantity = newGlobalStock;
    variation.costPrice = vendorReceivesPerUnit;
    if (!variation.price || parseFloat(variation.price) === 0) {
      variation.price = price;
    }
    await variation.save({ transaction });

    // Record Inventory Movement
    await InventoryMovement.create({
      variationId: variation.id,
      quantityChanged: qty,
      previousStock: prevGlobalStock,
      newStock: newGlobalStock,
      type: 'Restock',
      notes: `Vendor "${req.user.vendorProfile.companyName}" Stock In: +${qty} units @ Rs ${price} (Vendor receives Rs ${vendorReceivesPerUnit}/unit) [Vendor Stock: ${newVendorQty}]`,
      userId: req.user.id,
      vendorId: vendorId
    }, { transaction });

    await transaction.commit();

    const resultStock = await VendorStock.findByPk(vendorStock.id, {
      include: [
        {
          model: ProductVariation,
          as: 'variation',
          include: [{ model: Product, as: 'product' }]
        }
      ]
    });

    res.status(200).json({
      success: true,
      message: `Successfully stocked in ${qty} unit(s).`,
      data: {
        vendorStock: resultStock,
        sellingPrice: price,
        platformFeePercentage: commissionRate,
        platformFeePerUnit: commissionPerUnit,
        vendorReceivesPerUnit,
        totalVendorReceives: parseFloat((vendorReceivesPerUnit * qty).toFixed(2)),
        vendorStockQuantity: newVendorQty,
        policyNote: VENDOR_POLICY_NOTE
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Vendor Stock Out for a selected SKU (only for their own stock)
// @route   POST /api/vendors/stock/out
// @access  Private (Vendor)
const vendorStockOut = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    if (req.user.role !== 'Vendor' || !req.user.vendorProfile) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Access denied: Vendor account required' });
    }

    const vendorId = req.user.vendorProfile.id;
    const { variationId, quantity, reason } = req.body;

    if (!variationId) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'SKU variation selection is required' });
    }

    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Please provide a valid stock quantity to remove (minimum 1)' });
    }

    const vendorStock = await VendorStock.findOne({
      where: { vendorId, variationId },
      include: [
        {
          model: ProductVariation,
          as: 'variation',
          include: [{ model: Product, as: 'product' }]
        }
      ],
      transaction
    });

    if (!vendorStock || vendorStock.quantity <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'You have no stock recorded for this SKU'
      });
    }

    if (vendorStock.quantity < qty) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot stock out ${qty} units. You only have ${vendorStock.quantity} unit(s) of your own stock.`
      });
    }

    const prevVendorQty = vendorStock.quantity;
    const newVendorQty = prevVendorQty - qty;
    vendorStock.quantity = newVendorQty;
    await vendorStock.save({ transaction });

    // Update global variation stock
    const variation = vendorStock.variation;
    const prevGlobalStock = variation.stockQuantity;
    const newGlobalStock = Math.max(0, prevGlobalStock - qty);
    variation.stockQuantity = newGlobalStock;
    await variation.save({ transaction });

    // Record Inventory Movement
    await InventoryMovement.create({
      variationId: variation.id,
      quantityChanged: -qty,
      previousStock: prevGlobalStock,
      newStock: newGlobalStock,
      type: 'Correction',
      notes: `Vendor "${req.user.vendorProfile.companyName}" Stock Out: -${qty} units (${reason || 'Withdrawn by vendor'}) [Remaining vendor stock: ${newVendorQty}]`,
      userId: req.user.id,
      vendorId: vendorId
    }, { transaction });

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: `Successfully stocked out ${qty} unit(s).`,
      data: {
        vendorStock,
        vendorStockQuantity: newVendorQty,
        quantityRemoved: qty
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Get all vendor stock records for logged-in vendor
// @route   GET /api/vendors/stock/my-stock
// @access  Private (Vendor)
const getMyVendorStock = async (req, res, next) => {
  try {
    if (req.user.role !== 'Vendor' || !req.user.vendorProfile) {
      return res.status(403).json({ success: false, message: 'Access denied: Vendor account required' });
    }

    const vendorId = req.user.vendorProfile.id;

    const stocks = await VendorStock.findAll({
      where: { vendorId },
      include: [
        {
          model: ProductVariation,
          as: 'variation',
          include: [
            {
              model: Product,
              as: 'product',
              include: [{ model: Media, as: 'media' }]
            }
          ]
        }
      ],
      order: [['updatedAt', 'DESC']]
    });

    res.json({
      success: true,
      count: stocks.length,
      data: stocks,
      policyNote: VENDOR_POLICY_NOTE
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// VENDOR 30-DAY USED CONSOLE ADS MANAGEMENT
// ==========================================

// @desc    Get all 30-day used console ads for authenticated vendor or admin
// @route   GET /api/vendors/used-consoles
// @access  Private (Vendor, Admin, Super Admin, Staff)
const getVendorUsedConsoles = async (req, res, next) => {
  try {
    const isVendorRole = req.user.role === 'Vendor';
    const vendorId = req.user.vendorProfile?.id;

    if (isVendorRole && !vendorId) {
      return res.status(403).json({ success: false, message: 'Vendor profile not found for user' });
    }

    const now = new Date();

    const { status, adStatus, search, vendorId: filterVendorId } = req.query;
    const where = {};

    if (isVendorRole) {
      where.vendorId = vendorId;
    } else if (filterVendorId) {
      where.vendorId = filterVendorId;
    } else {
      // Admin / Super Admin / Staff sees all vendor listings
      where.sellerType = 'Vendor';
    }

    // Auto-disable expired ads
    await SellRequest.update(
      { adStatus: 'Expired', isAutoDisabled: true },
      {
        where: {
          ...where,
          adStatus: 'Active',
          expiresAt: { [Op.lt]: now }
        }
      }
    );

    if (adStatus && adStatus !== 'All') where.adStatus = adStatus;
    if (status && status !== 'All') where.status = status;

    if (search) {
      const cleanSearch = `%${search.trim().toLowerCase()}%`;
      where[Op.or] = [
        { productName: { [Op.iLike]: cleanSearch } },
        { platform: { [Op.iLike]: cleanSearch } },
        { brand: { [Op.iLike]: cleanSearch } },
        { variant: { [Op.iLike]: cleanSearch } },
        { modelNumber: { [Op.iLike]: cleanSearch } },
        { description: { [Op.iLike]: cleanSearch } },
        { vendorCompany: { [Op.iLike]: cleanSearch } }
      ];
    }

    const ads = await SellRequest.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    const decorated = ads.map((ad) => {
      const plain = ad.toJSON ? ad.toJSON() : ad;
      const isExpired = plain.expiresAt ? new Date(plain.expiresAt) < now : false;
      const daysRemaining = plain.expiresAt
        ? Math.max(0, Math.ceil((new Date(plain.expiresAt) - now) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        ...plain,
        isExpired,
        daysRemaining
      };
    });

    const counts = {
      total: decorated.length,
      active: decorated.filter(a => a.adStatus === 'Active' && !a.isExpired).length,
      expired: decorated.filter(a => a.adStatus === 'Expired' || a.isExpired).length,
      disabled: decorated.filter(a => a.adStatus === 'Disabled').length,
      sold: decorated.filter(a => a.adStatus === 'Sold').length
    };

    res.json({
      success: true,
      counts,
      count: decorated.length,
      data: decorated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Vendor or Admin posts a new 30-day Used Console Ad
// @route   POST /api/vendors/used-consoles
// @access  Private (Vendor, Admin, Super Admin, Staff)
const createVendorUsedConsoleAd = async (req, res, next) => {
  try {
    const isVendorRole = req.user.role === 'Vendor';
    const vendorProfile = req.user.vendorProfile;

    if (isVendorRole && !vendorProfile) {
      return res.status(403).json({ success: false, message: 'Vendor profile not found for user' });
    }

    const {
      productName,
      title,
      platform,
      brand,
      variant,
      modelNumber,
      storage,
      color,
      edition,
      placement,
      condition,
      accessoriesIncluded,
      price,
      description,
      mediaUrls,
      embedMedia,
      tags,
      keywords,
      aliases,
      city,
      customerPhone,
      phone,
      preferredContact,
      vendorId: specifiedVendorId,
      vendorCompany: specifiedVendorCompany
    } = req.body;

    const finalProductName = productName || title || `${brand || ''} ${platform || ''} ${variant || ''}`.trim() || 'Used Console';
    const now = new Date();
    // 30 days active lifecycle
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const vendorId = vendorProfile?.id || specifiedVendorId || null;
    const vendorCompany = vendorProfile?.companyName || specifiedVendorCompany || 'Quickturn Verified Supplier';
    const contactName = vendorProfile?.companyName || vendorProfile?.contactPerson || req.user.name;
    const contactEmail = vendorProfile?.email || req.user.email;
    const contactPhone = customerPhone || phone || vendorProfile?.phone || req.user.phone || null;
    const sellerCity = city || vendorProfile?.city || 'Karachi';

    const ad = await SellRequest.create({
      customerName: contactName,
      customerEmail: contactEmail,
      customerPhone: contactPhone,
      city: sellerCity,
      preferredContact: preferredContact || 'WhatsApp',
      sellerType: 'Vendor',
      vendorId,
      vendorCompany,
      userId: req.user.id,
      listingType: 'Used Console Ad',
      productName: finalProductName,
      platform: platform || 'PS5',
      brand: brand || 'Sony',
      variant: variant || 'Slim',
      modelNumber: modelNumber || null,
      storage: storage || null,
      color: color || null,
      edition: edition || null,
      placement: placement || 'Horizontal',
      condition: condition || 'Used - Like New',
      accessoriesIncluded: accessoriesIncluded || null,
      price: price ? parseFloat(price) : null,
      description: description || `${finalProductName} in ${condition || 'used'} condition posted by verified supplier ${vendorCompany}.`,
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
      embedMedia: embedMedia ? embedMedia.trim() : null,
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
      keywords: Array.isArray(keywords) ? keywords : (typeof keywords === 'string' ? keywords.split(',').map(k => k.trim()).filter(Boolean) : []),
      aliases: Array.isArray(aliases) ? aliases : (typeof aliases === 'string' ? aliases.split(',').map(a => a.trim()).filter(Boolean) : []),
      expiresAt,
      adStatus: 'Active',
      isAutoDisabled: false,
      status: 'Approved' // Vendor ads are verified & pre-approved
    });

    const plain = ad.toJSON ? ad.toJSON() : ad;
    const daysRemaining = 30;

    res.status(201).json({
      success: true,
      message: 'Used console ad published successfully for 30 days!',
      data: {
        ...plain,
        daysRemaining,
        isExpired: false
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Vendor or Admin updates ad / renews (+30 days) / toggles active status / marks sold
// @route   PUT /api/vendors/used-consoles/:id
// @access  Private (Vendor, Admin, Super Admin, Staff)
const updateVendorUsedConsoleAd = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isVendorRole = req.user.role === 'Vendor';
    const where = { id };

    if (isVendorRole) {
      const vendorProfile = req.user.vendorProfile;
      if (!vendorProfile) {
        return res.status(403).json({ success: false, message: 'Vendor profile not found' });
      }
      where.vendorId = vendorProfile.id;
    }

    const ad = await SellRequest.findOne({ where });

    if (!ad) {
      return res.status(404).json({ success: false, message: 'Console ad not found or not owned by vendor' });
    }

    const updateData = { ...req.body };

    // Action: Extend ad duration by 30 days
    if (req.body.action === 'extend_30_days') {
      const now = new Date();
      updateData.expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      updateData.adStatus = 'Active';
      updateData.isAutoDisabled = false;
      delete updateData.action;
    }

    // Action: Toggle disable / enable
    if (req.body.action === 'toggle_active') {
      if (ad.adStatus === 'Active') {
        updateData.adStatus = 'Disabled';
      } else {
        const now = new Date();
        updateData.adStatus = 'Active';
        updateData.isAutoDisabled = false;
        if (!ad.expiresAt || new Date(ad.expiresAt) < now) {
          updateData.expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
      }
      delete updateData.action;
    }

    // Action: Mark as sold
    if (req.body.action === 'mark_sold') {
      updateData.adStatus = 'Sold';
      delete updateData.action;
    }

    await ad.update(updateData);

    const plain = ad.toJSON ? ad.toJSON() : ad;
    const now = new Date();
    const isExpired = plain.expiresAt ? new Date(plain.expiresAt) < now : false;
    const daysRemaining = plain.expiresAt
      ? Math.max(0, Math.ceil((new Date(plain.expiresAt) - now) / (1000 * 60 * 60 * 24)))
      : 0;

    res.json({
      success: true,
      message: 'Used console ad updated successfully',
      data: {
        ...plain,
        isExpired,
        daysRemaining
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Vendor or Admin deletes an ad
// @route   DELETE /api/vendors/used-consoles/:id
// @access  Private (Vendor, Admin, Super Admin, Staff)
const deleteVendorUsedConsoleAd = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isVendorRole = req.user.role === 'Vendor';
    const where = { id };

    if (isVendorRole) {
      const vendorProfile = req.user.vendorProfile;
      if (!vendorProfile) {
        return res.status(403).json({ success: false, message: 'Vendor profile not found' });
      }
      where.vendorId = vendorProfile.id;
    }

    const ad = await SellRequest.findOne({ where });

    if (!ad) {
      return res.status(404).json({ success: false, message: 'Console ad not found or not owned by vendor' });
    }

    await ad.destroy();
    res.json({ success: true, message: 'Console ad removed successfully' });
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
  getVendorDashboard,
  vendorStockIn,
  vendorStockOut,
  getMyVendorStock,
  getVendorUsedConsoles,
  createVendorUsedConsoleAd,
  updateVendorUsedConsoleAd,
  deleteVendorUsedConsoleAd,
  VENDOR_POLICY_NOTE
};
