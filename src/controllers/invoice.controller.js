const { Op } = require('sequelize');
const { Invoice, User, Order, ProductVariation, Product } = require('../models');

// Helper to generate the next unique invoice number
const generateNextInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const latest = await Invoice.findOne({
    where: {
      invoiceNumber: {
        [Op.like]: `${prefix}%`,
      },
    },
    order: [['createdAt', 'DESC']],
  });

  if (!latest) {
    return `${prefix}0001`;
  }

  const parts = latest.invoiceNumber.split('-');
  const seqPart = parseInt(parts[parts.length - 1], 10);
  const nextSeq = isNaN(seqPart) ? 1 : seqPart + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
};

// GET /api/invoices/next-number
const getNextInvoiceNumber = async (req, res, next) => {
  try {
    const nextNumber = await generateNextInvoiceNumber();
    res.json({
      success: true,
      data: { invoiceNumber: nextNumber },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/invoices
const getAllInvoices = async (req, res, next) => {
  try {
    const {
      search,
      status,
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;

    const where = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (paymentStatus && paymentStatus !== 'all') {
      where.paymentStatus = paymentStatus;
    }

    if (startDate && endDate) {
      where.issueDate = {
        [Op.between]: [startDate, endDate],
      };
    } else if (startDate) {
      where.issueDate = {
        [Op.gte]: startDate,
      };
    } else if (endDate) {
      where.issueDate = {
        [Op.lte]: endDate,
      };
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { invoiceNumber: { [Op.iLike || Op.like]: term } },
        { customerName: { [Op.iLike || Op.like]: term } },
        { customerEmail: { [Op.iLike || Op.like]: term } },
        { customerPhone: { [Op.iLike || Op.like]: term } },
      ];
    }

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

    const { count, rows } = await Invoice.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phoneNumber'],
        },
        {
          model: Order,
          as: 'order',
          attributes: ['id', 'orderNumber', 'orderStatus', 'totalAmount'],
        },
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit, 10),
      offset,
    });

    // Summary statistics for the dashboard
    const allMatching = await Invoice.findAll({
      attributes: ['totalAmount', 'status', 'paymentStatus'],
    });

    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let paidCount = 0;
    let pendingCount = 0;

    allMatching.forEach((inv) => {
      const amt = parseFloat(inv.totalAmount) || 0;
      totalInvoiced += amt;
      if (inv.paymentStatus === 'Paid' || inv.status === 'Paid') {
        totalPaid += amt;
        paidCount++;
      } else if (inv.status !== 'Cancelled') {
        totalPending += amt;
        pendingCount++;
      }
    });

    res.json({
      success: true,
      data: rows,
      meta: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(count / parseInt(limit, 10)),
        summary: {
          totalInvoiced,
          totalPaid,
          totalPending,
          totalInvoicesCount: allMatching.length,
          paidCount,
          pendingCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/invoices/:id
const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findByPk(id, {
      include: [
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phoneNumber'],
        },
        {
          model: Order,
          as: 'order',
          attributes: ['id', 'orderNumber', 'orderStatus', 'totalAmount', 'createdAt'],
        },
      ],
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// Helper to compute line items and financial totals
const computeInvoiceTotals = (items = [], discountAmount = 0, shippingFee = 0, taxAmount = 0) => {
  const normalizedItems = (items || []).map((item, idx) => {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const unitPrice = Math.max(0, parseFloat(item.price) || 0);
    const total = parseFloat((qty * unitPrice).toFixed(2));

    return {
      id: item.id || `item-${Date.now()}-${idx}`,
      productId: item.productId || null,
      variationId: item.variationId || null,
      title: item.title ? String(item.title).trim() : 'Item',
      sku: item.sku ? String(item.sku).trim() : '',
      description: item.description ? String(item.description).trim() : '',
      price: unitPrice,
      quantity: qty,
      total,
    };
  });

  const subtotal = parseFloat(
    normalizedItems.reduce((acc, curr) => acc + curr.total, 0).toFixed(2)
  );
  const discount = Math.max(0, parseFloat(discountAmount) || 0);
  const shipping = Math.max(0, parseFloat(shippingFee) || 0);
  const tax = Math.max(0, parseFloat(taxAmount) || 0);

  const totalAmount = parseFloat(Math.max(0, subtotal - discount + shipping + tax).toFixed(2));

  return {
    items: normalizedItems,
    subtotal,
    discountAmount: discount,
    shippingFee: shipping,
    taxAmount: tax,
    totalAmount,
  };
};

// POST /api/invoices
const createInvoice = async (req, res, next) => {
  try {
    const {
      invoiceNumber: customNumber,
      issueDate,
      dueDate,
      status,
      paymentMethod,
      paymentStatus,
      customerId,
      orderId,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      companyName,
      companyLogo,
      companyAddress,
      companyPhone,
      companyEmail,
      companyWebsite,
      headerNote,
      items,
      discountAmount,
      shippingFee,
      taxAmount,
      footerNotes,
      paymentTerms,
      authorizedSignatory,
      showSignatureSection,
      notes,
    } = req.body;

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Customer name is required to create an invoice',
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invoice must contain at least one line item',
      });
    }

    let finalInvoiceNumber = customNumber ? customNumber.trim() : '';
    if (!finalInvoiceNumber) {
      finalInvoiceNumber = await generateNextInvoiceNumber();
    } else {
      const existing = await Invoice.findOne({
        where: { invoiceNumber: finalInvoiceNumber },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Invoice number "${finalInvoiceNumber}" is already in use. Please choose another or leave blank to auto-generate.`,
        });
      }
    }

    const totals = computeInvoiceTotals(items, discountAmount, shippingFee, taxAmount);

    const invoice = await Invoice.create({
      invoiceNumber: finalInvoiceNumber,
      issueDate: issueDate || new Date().toISOString().split('T')[0],
      dueDate: dueDate || null,
      status: status || 'Pending',
      paymentMethod: paymentMethod || 'Cash on Delivery',
      paymentStatus: paymentStatus || (status === 'Paid' ? 'Paid' : 'Unpaid'),
      customerId: customerId || null,
      orderId: orderId || null,
      customerName: customerName.trim(),
      customerEmail: customerEmail ? customerEmail.trim() : null,
      customerPhone: customerPhone ? customerPhone.trim() : null,
      customerAddress: customerAddress ? customerAddress.trim() : null,
      customerCity: customerCity ? customerCity.trim() : null,
      companyName: companyName || 'Quick Turn Gaming & Repairs',
      companyLogo: companyLogo || '/logo.png',
      companyAddress:
        companyAddress || 'Shop #12, Gaming Plaza, Saddar, Karachi, Pakistan',
      companyPhone: companyPhone || '+92 300 1234567',
      companyEmail: companyEmail || 'info@quickturn.pk',
      companyWebsite: companyWebsite || 'www.quickturn.pk',
      headerNote:
        headerNote || 'Official Commercial Invoice & Warranty Receipt',
      items: totals.items,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      shippingFee: totals.shippingFee,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      footerNotes:
        footerNotes !== undefined
          ? footerNotes
          : 'Thank you for choosing Quick Turn! 7-day checking warranty on pre-owned items. For repairs, 30-day service warranty applies.',
      paymentTerms:
        paymentTerms !== undefined
          ? paymentTerms
          : 'Payment Method: Cash / Bank Transfer. Bank: Meezan Bank | A/C Title: Quick Turn Store | A/C: 0101-01020304-01',
      authorizedSignatory: authorizedSignatory || 'Quick Turn Store Manager',
      showSignatureSection: showSignatureSection !== undefined ? Boolean(showSignatureSection) : true,
      notes: notes || null,
    });

    const fullInvoice = await Invoice.findByPk(invoice.id, {
      include: [
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phoneNumber'],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Invoice generated successfully',
      data: fullInvoice,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/invoices/:id
const updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    const {
      invoiceNumber,
      issueDate,
      dueDate,
      status,
      paymentMethod,
      paymentStatus,
      customerId,
      orderId,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      companyName,
      companyLogo,
      companyAddress,
      companyPhone,
      companyEmail,
      companyWebsite,
      headerNote,
      items,
      discountAmount,
      shippingFee,
      taxAmount,
      footerNotes,
      paymentTerms,
      authorizedSignatory,
      showSignatureSection,
      notes,
    } = req.body;

    if (invoiceNumber && invoiceNumber !== invoice.invoiceNumber) {
      const existing = await Invoice.findOne({
        where: { invoiceNumber: invoiceNumber.trim() },
      });
      if (existing && existing.id !== invoice.id) {
        return res.status(400).json({
          success: false,
          message: `Invoice number "${invoiceNumber}" is already in use by another invoice`,
        });
      }
      invoice.invoiceNumber = invoiceNumber.trim();
    }

    if (customerName) invoice.customerName = customerName.trim();
    if (customerEmail !== undefined) invoice.customerEmail = customerEmail ? customerEmail.trim() : null;
    if (customerPhone !== undefined) invoice.customerPhone = customerPhone ? customerPhone.trim() : null;
    if (customerAddress !== undefined) invoice.customerAddress = customerAddress ? customerAddress.trim() : null;
    if (customerCity !== undefined) invoice.customerCity = customerCity ? customerCity.trim() : null;

    if (issueDate) invoice.issueDate = issueDate;
    if (dueDate !== undefined) invoice.dueDate = dueDate || null;
    if (status) {
      invoice.status = status;
      if (status === 'Paid' && !paymentStatus) {
        invoice.paymentStatus = 'Paid';
      }
    }
    if (paymentStatus) invoice.paymentStatus = paymentStatus;
    if (paymentMethod !== undefined) invoice.paymentMethod = paymentMethod;

    if (companyName !== undefined) invoice.companyName = companyName;
    if (companyLogo !== undefined) invoice.companyLogo = companyLogo;
    if (companyAddress !== undefined) invoice.companyAddress = companyAddress;
    if (companyPhone !== undefined) invoice.companyPhone = companyPhone;
    if (companyEmail !== undefined) invoice.companyEmail = companyEmail;
    if (companyWebsite !== undefined) invoice.companyWebsite = companyWebsite;
    if (headerNote !== undefined) invoice.headerNote = headerNote;
    if (footerNotes !== undefined) invoice.footerNotes = footerNotes;
    if (paymentTerms !== undefined) invoice.paymentTerms = paymentTerms;
    if (authorizedSignatory !== undefined) invoice.authorizedSignatory = authorizedSignatory;
    if (showSignatureSection !== undefined) invoice.showSignatureSection = Boolean(showSignatureSection);
    if (notes !== undefined) invoice.notes = notes;

    if (customerId !== undefined) invoice.customerId = customerId || null;
    if (orderId !== undefined) invoice.orderId = orderId || null;

    // Recalculate totals if items or fees provided
    const itemsToCompute = items !== undefined ? items : invoice.items;
    const discountToCompute = discountAmount !== undefined ? discountAmount : invoice.discountAmount;
    const shippingToCompute = shippingFee !== undefined ? shippingFee : invoice.shippingFee;
    const taxToCompute = taxAmount !== undefined ? taxAmount : invoice.taxAmount;

    const totals = computeInvoiceTotals(itemsToCompute, discountToCompute, shippingToCompute, taxToCompute);

    invoice.items = totals.items;
    invoice.subtotal = totals.subtotal;
    invoice.discountAmount = totals.discountAmount;
    invoice.shippingFee = totals.shippingFee;
    invoice.taxAmount = totals.taxAmount;
    invoice.totalAmount = totals.totalAmount;

    await invoice.save();

    const updated = await Invoice.findByPk(invoice.id, {
      include: [
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phoneNumber'],
        },
        {
          model: Order,
          as: 'order',
          attributes: ['id', 'orderNumber'],
        },
      ],
    });

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/invoices/:id
const deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    await invoice.destroy();

    res.json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/invoices/from-order/:orderId
const createFromOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: User,
          as: 'customer',
        },
        {
          association: 'items',
          include: [
            {
              model: ProductVariation,
              as: 'variation',
              include: [{ model: Product, as: 'product' }],
            },
          ],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order record not found',
      });
    }

    // Map order items to invoice line items
    const invoiceItems = (order.items || []).map((item, index) => {
      const prodTitle = item.variation?.product?.title || 'Catalog Product';
      const sku = item.variation?.sku || '';
      return {
        id: `order-item-${index + 1}`,
        productId: item.variation?.productId || null,
        variationId: item.variationId || null,
        title: prodTitle,
        sku,
        description: sku ? `SKU: ${sku}` : '',
        price: parseFloat(item.price) || 0,
        quantity: parseInt(item.quantity, 10) || 1,
        total: (parseFloat(item.price) || 0) * (parseInt(item.quantity, 10) || 1),
      };
    });

    const invoiceNumber = await generateNextInvoiceNumber();

    const customerName =
      order.customer?.name ||
      order.shippingAddress?.receiverName ||
      order.billingAddress?.receiverName ||
      'Store Customer';

    const customerEmail = order.customer?.email || '';
    const customerPhone =
      order.customer?.phoneNumber ||
      order.shippingAddress?.receiverPhone ||
      '';

    const ship = order.shippingAddress || {};
    const street = ship.streetAddress || ship.street || '';
    const city = ship.city || '';
    const state = ship.state || '';
    const country = ship.country || 'Pakistan';
    const addressFormatted = [street, city, state, country].filter(Boolean).join(', ');

    const totals = computeInvoiceTotals(
      invoiceItems,
      order.discountAmount || 0,
      order.shippingFee || 0,
      0
    );

    const invoice = await Invoice.create({
      invoiceNumber,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      status: order.paymentStatus === 'Paid' ? 'Paid' : 'Pending',
      paymentMethod: order.paymentMethod || 'Cash on Delivery',
      paymentStatus: order.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid',
      customerId: order.customerId || null,
      orderId: order.id,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress: addressFormatted,
      customerCity: city,
      companyLogo: '/logo.png',
      items: totals.items,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      shippingFee: totals.shippingFee,
      taxAmount: 0,
      totalAmount: totals.totalAmount,
      notes: `Generated automatically from Order #${order.orderNumber}`,
    });

    res.status(201).json({
      success: true,
      message: `Invoice ${invoiceNumber} created from order #${order.orderNumber}`,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getNextInvoiceNumber,
  createFromOrder,
};
