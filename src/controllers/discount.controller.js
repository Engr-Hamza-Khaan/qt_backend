const { Op } = require('sequelize');
const { Discount, Category, Product } = require('../models');

// @desc    Create a discount campaign or coupon
// @route   POST /api/discounts
// @access  Private (Admin/Staff)
const createDiscount = async (req, res, next) => {
  try {
    const { name, code, type, value, applyTo, targetId, minPurchaseAmount, startDate, endDate, isActive } = req.body;

    // Check if coupon code already exists
    if (code) {
      const codeExists = await Discount.findOne({ where: { code } });
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
      targetId,
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

    await discount.update(req.body);
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
    const { code, cartAmount } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const discount = await Discount.findOne({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        startDate: { [Op.lte]: new Date() },
        endDate: { [Op.gte]: new Date() }
      }
    });

    if (!discount) {
      return res.status(400).json({ success: false, message: 'Invalid or expired coupon code' });
    }

    const minAmount = parseFloat(discount.minPurchaseAmount);
    const cartVal = parseFloat(cartAmount || 0);

    if (cartVal < minAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of $${minAmount} required to use this coupon`
      });
    }

    let calculatedDiscount = 0;
    if (discount.type === 'Percentage') {
      calculatedDiscount = (parseFloat(discount.value) / 100) * cartVal;
    } else {
      calculatedDiscount = parseFloat(discount.value);
    }

    // Cap the discount at the cart value
    calculatedDiscount = Math.min(calculatedDiscount, cartVal);

    res.json({
      success: true,
      message: 'Coupon code applied successfully',
      data: {
        id: discount.id,
        name: discount.name,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        discountAmount: calculatedDiscount
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDiscount,
  updateDiscount,
  deleteDiscount,
  getDiscounts,
  validateCoupon
};
