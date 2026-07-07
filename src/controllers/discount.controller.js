const { Discount } = require('../models');
const { validateAndApplyCoupon } = require('../utils/discount.service');

// @desc    Create a discount campaign or coupon
// @route   POST /api/discounts
// @access  Private (Admin/Staff)
const createDiscount = async (req, res, next) => {
  try {
    const { name, code, type, value, applyTo, targetId, minPurchaseAmount, startDate, endDate, isActive } = req.body;

    if (code) {
      const codeExists = await Discount.findOne({ where: { code: code.toUpperCase() } });
      if (codeExists) {
        return res.status(400).json({ success: false, message: 'Coupon code already exists' });
      }
    }

    const discount = await Discount.create({
      name,
      code: code ? code.toUpperCase() : null,
      type,
      value,
      applyTo,
      targetId: targetId || null,
      minPurchaseAmount: minPurchaseAmount || 0.00,
      startDate,
      endDate,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({ success: true, data: discount });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a discount
// @route   PUT /api/discounts/:id
// @access  Private (Admin/Staff)
const updateDiscount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const discount = await Discount.findByPk(id);
    if (!discount) return res.status(404).json({ success: false, message: 'Discount not found' });

    const updates = { ...req.body };
    if (updates.code) updates.code = updates.code.toUpperCase();

    await discount.update(updates);
    res.json({ success: true, data: discount });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a discount
// @route   DELETE /api/discounts/:id
// @access  Private (Admin/Staff)
const deleteDiscount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const discount = await Discount.findByPk(id);
    if (!discount) return res.status(404).json({ success: false, message: 'Discount not found' });

    await discount.destroy();
    res.json({ success: true, message: 'Discount deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all discounts
// @route   GET /api/discounts
// @access  Private (Admin/Staff)
const getDiscounts = async (req, res, next) => {
  try {
    const discounts = await Discount.findAll({ order: [['startDate', 'DESC']] });
    res.json({ success: true, data: discounts });
  } catch (error) {
    next(error);
  }
};

// @desc    Validate coupon code
// @route   POST /api/discounts/validate
// @access  Public
const validateCoupon = async (req, res, next) => {
  try {
    const { code, cartAmount, items } = req.body;
    const result = await validateAndApplyCoupon({ code, cartAmount, items });

    res.json({
      success: true,
      message: 'Coupon code applied successfully',
      data: {
        id: result.discount.id,
        name: result.discount.name,
        code: result.discount.code,
        type: result.discount.type,
        value: result.discount.value,
        applyTo: result.discount.applyTo,
        discountAmount: result.discountAmount,
        eligibleSubtotal: result.eligibleSubtotal,
      }
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
};

module.exports = {
  createDiscount,
  updateDiscount,
  deleteDiscount,
  getDiscounts,
  validateCoupon
};
