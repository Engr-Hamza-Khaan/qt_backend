const { Discount, ProductVariation, Product } = require('../models');

function getEndOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isDiscountActive(discount) {
  const now = new Date();
  if (!discount?.isActive) return false;
  if (new Date(discount.startDate) > now) return false;
  if (getEndOfDay(discount.endDate) < now) return false;
  return true;
}

async function resolveCartLines(items = [], cartAmount = 0) {
  if (!items?.length) {
    return { lines: [], subtotal: parseFloat(cartAmount || 0) };
  }

  const lines = [];
  let subtotal = 0;

  for (const item of items) {
    const qty = parseInt(item.quantity, 10) || 1;
    let unitPrice = parseFloat(item.price);
    let productId = item.productId;
    let categoryId = item.categoryId;
    let variationId = item.variationId;

    if (variationId) {
      const variation = await ProductVariation.findByPk(variationId, {
        include: [{ model: Product, as: 'product', attributes: ['id', 'categoryId'] }],
      });
      if (!variation || !variation.isActive) continue;
      unitPrice = parseFloat(variation.price);
      productId = variation.productId;
      categoryId = variation.product?.categoryId;
      variationId = variation.id;
    }

    if (!Number.isFinite(unitPrice)) continue;

    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    lines.push({ variationId, productId, categoryId, quantity: qty, unitPrice, lineTotal });
  }

  return { lines, subtotal };
}

function getEligibleSubtotal(discount, lines, fallbackSubtotal) {
  if (!discount || discount.applyTo === 'All') {
    return lines.length ? lines.reduce((sum, line) => sum + line.lineTotal, 0) : fallbackSubtotal;
  }

  return lines.reduce((sum, line) => {
    let matches = false;
    if (discount.applyTo === 'Category' && line.categoryId === discount.targetId) matches = true;
    if (discount.applyTo === 'Product' && line.productId === discount.targetId) matches = true;
    if (discount.applyTo === 'Variation' && line.variationId === discount.targetId) matches = true;
    return matches ? sum + line.lineTotal : sum;
  }, 0);
}

function calculateDiscountAmount(discount, eligibleSubtotal) {
  let amount = 0;
  if (discount.type === 'Percentage') {
    amount = (parseFloat(discount.value) / 100) * eligibleSubtotal;
  } else {
    amount = parseFloat(discount.value);
  }
  return Math.min(amount, eligibleSubtotal);
}

async function validateAndApplyCoupon({ code, cartAmount, items = [] }) {
  if (!code?.trim()) {
    const err = new Error('Coupon code is required');
    err.statusCode = 400;
    throw err;
  }

  const discount = await Discount.findOne({
    where: {
      code: code.trim().toUpperCase(),
      isActive: true,
    },
  });

  if (!discount || !isDiscountActive(discount)) {
    const err = new Error('Invalid or expired coupon code');
    err.statusCode = 400;
    throw err;
  }

  const { lines, subtotal } = await resolveCartLines(items, cartAmount);
  const cartSubtotal = subtotal || parseFloat(cartAmount || 0);
  const eligibleSubtotal = getEligibleSubtotal(discount, lines, cartSubtotal);

  if (eligibleSubtotal <= 0) {
    const err = new Error('This coupon does not apply to any items in your cart');
    err.statusCode = 400;
    throw err;
  }

  const minAmount = parseFloat(discount.minPurchaseAmount || 0);
  if (eligibleSubtotal < minAmount) {
    const err = new Error(`Minimum purchase of Rs ${minAmount} required to use this coupon`);
    err.statusCode = 400;
    throw err;
  }

  const discountAmount = calculateDiscountAmount(discount, eligibleSubtotal);

  return {
    discount,
    discountAmount,
    eligibleSubtotal,
    cartSubtotal,
  };
}

module.exports = {
  validateAndApplyCoupon,
  isDiscountActive,
};
