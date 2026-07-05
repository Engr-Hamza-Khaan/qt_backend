const { Op } = require('sequelize');
const { sequelize, Order, OrderItem, ProductVariation, Product, VendorProfile, SupplierLedger, InventoryMovement, User } = require('../models');

// Helper to generate Shopify-style order number: "QT-10001" etc.
const generateOrderNumber = async () => {
  const latestOrder = await Order.findOne({
    order: [['createdAt', 'DESC']]
  });
  if (!latestOrder) return 'QT-10001';
  const lastNum = parseInt(latestOrder.orderNumber.replace('QT-', ''));
  return `QT-${lastNum + 1}`;
};

// @desc    Create a new order (Checkout)
// @route   POST /api/orders
// @access  Private (Customer/Admin)
const createOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { items, shippingAddress, billingAddress, paymentMethod, orderNotes, customerNotes, couponCode, discountAmount } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in order' });
    }

    const orderNumber = await generateOrderNumber();
    let totalAmount = 0;

    // First validate items and calculate prices
    const parsedItems = [];
    for (const item of items) {
      const variation = await ProductVariation.findByPk(item.variationId, {
        include: [{ model: Product, as: 'product' }]
      });

      if (!variation || !variation.isActive) {
        return res.status(404).json({ success: false, message: `Product SKU variation ${item.variationId} not found or inactive` });
      }

      const itemTotal = parseFloat(variation.price) * item.quantity;
      totalAmount += itemTotal;

      parsedItems.push({
        variationId: variation.id,
        quantity: item.quantity,
        price: variation.price,
        // Initially costPrice and vendorId are null until Admin assigns a supplier
        costPrice: null,
        vendorId: null,
        fulfillmentStatus: 'Unassigned'
      });
    }

    // Apply discount
    const finalDiscount = discountAmount ? parseFloat(discountAmount) : 0;
    const totalWithDiscount = Math.max(0, totalAmount - finalDiscount);

    const order = await Order.create({
      orderNumber,
      customerId: req.user.id,
      totalAmount: totalWithDiscount,
      discountAmount: finalDiscount,
      couponCode,
      shippingAddress,
      billingAddress,
      paymentMethod,
      orderNotes,
      customerNotes,
      paymentStatus: 'Pending',
      orderStatus: 'Pending'
    }, { transaction });

    // Create Order Items
    for (const item of parsedItems) {
      await OrderItem.create({
        orderId: order.id,
        ...item
      }, { transaction });
    }

    await transaction.commit();

    const fullOrder = await Order.findByPk(order.id, {
      include: [{ model: OrderItem, as: 'items', include: [{ model: ProductVariation, as: 'variation', include: [{ model: Product, as: 'product' }] }] }]
    });

    res.status(201).json({ success: true, data: fullOrder });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Assign a supplier to an order line item
// @route   POST /api/orders/:orderId/items/:itemId/assign-supplier
// @access  Private (Admin/Super Admin)
const assignSupplier = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { orderId, itemId } = req.params;
    const { vendorId } = req.body; // The selected supplier/vendor ID

    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const orderItem = await OrderItem.findOne({
      where: { id: itemId, orderId }
    });
    if (!orderItem) return res.status(404).json({ success: false, message: 'Order line item not found' });

    if (orderItem.fulfillmentStatus !== 'Unassigned') {
      return res.status(400).json({ success: false, message: 'Supplier is already assigned to this item' });
    }

    // Verify vendor profile
    const vendor = await VendorProfile.findByPk(vendorId);
    if (!vendor || vendor.status !== 'Active') {
      return res.status(400).json({ success: false, message: 'Selected vendor is not active or not found' });
    }

    // Find the variation to check stock and cost price
    const variation = await ProductVariation.findByPk(orderItem.variationId);
    if (!variation) return res.status(404).json({ success: false, message: 'Product variation not found' });

    if (variation.stockQuantity < orderItem.quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for SKU ${variation.sku}. Available: ${variation.stockQuantity}, Requested: ${orderItem.quantity}`
      });
    }

    // 1. Reduce vendor's inventory
    const prevStock = variation.stockQuantity;
    const newStock = prevStock - orderItem.quantity;
    variation.stockQuantity = newStock;
    await variation.save({ transaction });

    // 2. Log inventory movement
    await InventoryMovement.create({
      variationId: variation.id,
      quantityChanged: -orderItem.quantity,
      previousStock: prevStock,
      newStock: newStock,
      type: 'Supplier Allocation',
      notes: `Fulfillment allocation for Order ${order.orderNumber}`,
      userId: req.user.id,
      vendorId: vendor.id
    }, { transaction });

    // 3. Update order item with vendor details & cost price
    // We lock in the vendor's costPrice at assignment time
    orderItem.vendorId = vendor.id;
    orderItem.costPrice = variation.costPrice;
    orderItem.fulfillmentStatus = 'Assigned';
    await orderItem.save({ transaction });

    // 4. Update vendor profile ledger balances
    // earnings = quantity * cost price
    const earnings = orderItem.quantity * parseFloat(variation.costPrice);
    const newBalance = parseFloat(vendor.balance) + earnings;
    vendor.balance = newBalance;
    await vendor.save({ transaction });

    // 5. Create supplier ledger record (Credit)
    await SupplierLedger.create({
      vendorId: vendor.id,
      type: 'Sale Credit',
      amount: earnings,
      balanceAfter: newBalance,
      referenceId: order.id,
      notes: `Earnings from Order ${order.orderNumber} for variation SKU: ${variation.sku}`
    }, { transaction });

    // 6. Check if all items in this order are now assigned
    const unassignedCount = await OrderItem.count({
      where: { orderId, fulfillmentStatus: 'Unassigned' },
      transaction
    });

    if (unassignedCount === 0) {
      order.orderStatus = 'Supplier Assigned';
      await order.save({ transaction });
    } else if (order.orderStatus === 'Pending') {
      order.orderStatus = 'Processing';
      await order.save({ transaction });
    }

    await transaction.commit();
    res.json({ success: true, message: 'Supplier assigned and inventory allocated successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private (Admin/Staff/Vendor)
const getOrders = async (req, res, next) => {
  try {
    const {
      orderStatus,
      paymentStatus,
      search,
      dateFrom,
      dateTo,
      vendorId,
      page = 1,
      limit = 20
    } = req.query;

    const where = {};
    const itemWhere = {};

    if (orderStatus) where.orderStatus = orderStatus;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    if (search) {
      where.orderNumber = { [Op.iLike]: `%${search}%` };
    }

    if (dateFrom && dateTo) {
      where.createdAt = {
        [Op.between]: [new Date(dateFrom), new Date(dateTo)]
      };
    }

    // Role-based restrictions
    if (req.user.role === 'Vendor') {
      // Vendors only see order items assigned to them
      itemWhere.vendorId = req.user.vendorProfile.id;
    } else if (vendorId) {
      // Admins can filter by specific vendor assignment
      itemWhere.vendorId = vendorId;
    }

    // Calculate pagination values
    const queryLimit = parseInt(limit);
    const queryOffset = (parseInt(page) - 1) * queryLimit;

    const { count, rows } = await Order.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: queryLimit,
      offset: queryOffset,
      distinct: true, // ensures correct count when including relations
      include: [
        {
          model: OrderItem,
          as: 'items',
          where: Object.keys(itemWhere).length > 0 ? itemWhere : undefined,
          required: Object.keys(itemWhere).length > 0, // Force inner join if filtering by vendor
          include: [
            {
              model: ProductVariation,
              as: 'variation',
              include: [{ model: Product, as: 'product' }]
            }
          ]
        },
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phoneNumber']
        }
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

// @desc    Get order details
// @route   GET /api/orders/:id
// @access  Private (Admin/Staff/Vendor/Customer)
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: ProductVariation,
              as: 'variation',
              include: [{ model: Product, as: 'product' }]
            },
            {
              model: VendorProfile,
              as: 'assignedVendor',
              attributes: ['id', 'companyName', 'email']
            }
          ]
        },
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phoneNumber']
        }
      ]
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Security check: Customers can only see their own orders
    if (req.user.role === 'Customer' && order.customerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }

    // Security check: Vendors only see items assigned to them
    if (req.user.role === 'Vendor') {
      order.items = order.items.filter(item => item.vendorId === req.user.vendorProfile.id);
      if (order.items.length === 0) {
        return res.status(403).json({ success: false, message: 'No items in this order are assigned to you' });
      }
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order statuses (shipping, payment, or order status)
// @route   PUT /api/orders/:id
// @access  Private (Admin/Staff)
const updateOrderStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { orderStatus, paymentStatus, trackingNumber, carrier, orderNotes } = req.body;

    const order = await Order.findByPk(id, {
      include: [{ model: OrderItem, as: 'items' }],
      transaction
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Handle refund status reversals
    if (orderStatus === 'Refunded' && order.orderStatus !== 'Refunded') {
      // Loop through assigned items, deduct vendor balance and log ledger refund
      for (const item of order.items) {
        if (item.vendorId && item.costPrice) {
          const vendor = await VendorProfile.findByPk(item.vendorId, { transaction });
          if (vendor) {
            const refundCost = item.quantity * parseFloat(item.costPrice);
            const newBalance = parseFloat(vendor.balance) - refundCost;
            vendor.balance = newBalance;
            await vendor.save({ transaction });

            await SupplierLedger.create({
              vendorId: vendor.id,
              type: 'Refund Debit',
              amount: refundCost,
              balanceAfter: newBalance,
              referenceId: order.id,
              notes: `Refund debit for Order ${order.orderNumber}`
            }, { transaction });
          }
        }
      }
      order.paymentStatus = 'Refunded';
    }

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (carrier) order.carrier = carrier;
    if (orderNotes) order.orderNotes = orderNotes;

    await order.save({ transaction });
    await transaction.commit();

    res.json({ success: true, message: 'Order status updated successfully', data: order });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Delete an order
// @route   DELETE /api/orders/:id
// @access  Private (Admin/Super Admin/Staff)
const deleteOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id, {
      include: [{ model: OrderItem, as: 'items' }],
      transaction
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    for (const item of order.items) {
      if (item.vendorId && item.costPrice && item.fulfillmentStatus === 'Assigned') {
        const vendor = await VendorProfile.findByPk(item.vendorId, { transaction });
        const variation = await ProductVariation.findByPk(item.variationId, { transaction });

        if (variation) {
          const prevStock = variation.stockQuantity;
          const newStock = prevStock + item.quantity;
          variation.stockQuantity = newStock;
          await variation.save({ transaction });

          await InventoryMovement.create({
            variationId: variation.id,
            quantityChanged: item.quantity,
            previousStock: prevStock,
            newStock,
            type: 'Return',
            notes: `Stock restored after deleting Order ${order.orderNumber}`,
            userId: req.user.id,
            vendorId: item.vendorId
          }, { transaction });
        }

        if (vendor) {
          const reversal = item.quantity * parseFloat(item.costPrice);
          vendor.balance = parseFloat(vendor.balance) - reversal;
          await vendor.save({ transaction });
        }
      }
    }

    await SupplierLedger.destroy({
      where: { referenceId: order.id },
      transaction
    });

    await order.destroy({ transaction });
    await transaction.commit();

    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

module.exports = {
  createOrder,
  assignSupplier,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder
};
