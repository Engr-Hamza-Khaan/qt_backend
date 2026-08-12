const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const productRoutes = require('./product.routes');
const orderRoutes = require('./order.routes');
const customerRoutes = require('./customer.routes');
const vendorRoutes = require('./vendor.routes');
const discountRoutes = require('./discount.routes');
const reportRoutes = require('./report.routes');
const servicesRoutes = require('./services.routes');
const storefrontRoutes = require('./storefront.routes');
const settingRoutes = require('./setting.routes');
const searchRoutes = require('./search.routes');

router.use('/auth', authRoutes);
router.use('/store', storefrontRoutes);
router.use('/store/search', searchRoutes);
router.use('/search', searchRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/customers', customerRoutes);
router.use('/vendors', vendorRoutes);
router.use('/discounts', discountRoutes);
router.use('/reports', reportRoutes);
router.use('/services', servicesRoutes);
router.use('/settings', settingRoutes);

module.exports = router;
