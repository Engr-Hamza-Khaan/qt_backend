const { Op } = require('sequelize');
const { sequelize, Order, OrderItem, ProductVariation, Product, VendorProfile, SupplierLedger, InventoryMovement, User } = require('../models');
const { validateAndApplyCoupon } = require('../utils/discount.service');

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

    let finalDiscount = 0;
    let appliedCouponCode = couponCode || null;

    if (couponCode) {
      try {
        const couponResult = await validateAndApplyCoupon({
          code: couponCode,
          cartAmount: totalAmount,
          items,
        });
        finalDiscount = couponResult.discountAmount;
        appliedCouponCode = couponResult.discount.code;
      } catch (couponError) {
        await transaction.rollback();
        return res.status(couponError.statusCode || 400).json({
          success: false,
          message: couponError.message,
        });
      }
    } else if (discountAmount && parseFloat(discountAmount) > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'A valid coupon code is required to apply a discount',
      });
    }

    const totalWithDiscount = Math.max(0, totalAmount - finalDiscount);

    const order = await Order.create({
      orderNumber,
      customerId: req.user.id,
      totalAmount: totalWithDiscount,
      discountAmount: finalDiscount,
      couponCode: appliedCouponCode,
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

// @desc    Update order (statuses, addresses, items, notes)
// @route   PUT /api/orders/:id
// @access  Private (Admin/Staff)
const updateOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      orderStatus,
      paymentStatus,
      trackingNumber,
      carrier,
      orderNotes,
      customerNotes,
      paymentMethod,
      shippingAddress,
      billingAddress,
      items
    } = req.body;

    const order = await Order.findByPk(id, {
      include: [{ model: OrderItem, as: 'items' }],
      transaction
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Handle items edit if provided
    if (Array.isArray(items) && items.length > 0) {
      const incomingItemIds = items.filter(i => i.id).map(i => i.id);
      
      // 1. Remove deleted items
      for (const existingItem of order.items) {
        if (!incomingItemIds.includes(existingItem.id)) {
          // If supplier was assigned, restore stock if variation exists
          if (existingItem.fulfillmentStatus === 'Assigned' && existingItem.variationId) {
            const variation = await ProductVariation.findByPk(existingItem.variationId, { transaction });
            if (variation) {
              variation.stockQuantity = variation.stockQuantity + existingItem.quantity;
              await variation.save({ transaction });
            }
          }
          await existingItem.destroy({ transaction });
        }
      }

      // 2. Add or update items & calculate subtotal
      let newSubtotal = 0;
      for (const item of items) {
        const variation = await ProductVariation.findByPk(item.variationId, { transaction });
        if (!variation) {
          await transaction.rollback();
          return res.status(404).json({ success: false, message: `Product variation ${item.variationId} not found` });
        }

        const itemPrice = item.price ? parseFloat(item.price) : parseFloat(variation.price);
        const qty = parseInt(item.quantity, 10) || 1;
        newSubtotal += itemPrice * qty;

        if (item.id) {
          // Update existing line item
          const existingItem = order.items.find(i => i.id === item.id);
          if (existingItem) {
            // Adjust stock if assigned and quantity changed
            if (existingItem.fulfillmentStatus === 'Assigned') {
              const qtyDiff = qty - existingItem.quantity;
              if (qtyDiff !== 0) {
                variation.stockQuantity = Math.max(0, variation.stockQuantity - qtyDiff);
                await variation.save({ transaction });
              }
            }
            existingItem.quantity = qty;
            existingItem.price = itemPrice;
            await existingItem.save({ transaction });
          }
        } else {
          // Add new line item
          await OrderItem.create({
            orderId: order.id,
            variationId: variation.id,
            quantity: qty,
            price: itemPrice,
            costPrice: null,
            vendorId: null,
            fulfillmentStatus: 'Unassigned'
          }, { transaction });
        }
      }

      // Recalculate order total amount with discount
      const discount = parseFloat(order.discountAmount) || 0;
      order.totalAmount = Math.max(0, newSubtotal - discount);
    }

    // Handle refund or return status reversals
    if ((orderStatus === 'Refunded' || orderStatus === 'Returned') && order.orderStatus !== 'Refunded' && order.orderStatus !== 'Returned') {
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
              notes: `Debit for ${orderStatus} Order ${order.orderNumber}`
            }, { transaction });
          }
        }

        // Restore stock for returned/refunded variation
        if (item.variationId) {
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
              notes: `Stock restored after order marked as ${orderStatus} (${order.orderNumber})`,
              userId: req.user.id,
              vendorId: item.vendorId || null
            }, { transaction });
          }
        }
      }
      if (orderStatus === 'Refunded') {
        order.paymentStatus = 'Refunded';
      }
    }

    if (orderStatus !== undefined) order.orderStatus = orderStatus;
    if (paymentStatus !== undefined) order.paymentStatus = paymentStatus;
    if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
    if (carrier !== undefined) order.carrier = carrier;
    if (orderNotes !== undefined) order.orderNotes = orderNotes;
    if (customerNotes !== undefined) order.customerNotes = customerNotes;
    if (paymentMethod !== undefined) order.paymentMethod = paymentMethod;
    if (shippingAddress !== undefined) order.shippingAddress = shippingAddress;
    if (billingAddress !== undefined) order.billingAddress = billingAddress;

    await order.save({ transaction });
    await transaction.commit();

    // Fetch updated order with associations
    const updatedOrder = await Order.findByPk(id, {
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

    res.json({ success: true, message: 'Order updated successfully', data: updatedOrder });
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
  updateOrder,
  updateOrderStatus: updateOrder,
  deleteOrder
};
