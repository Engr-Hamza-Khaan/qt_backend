const express = require('express');
const router = express.Router();
const {
  getHomeData,
  getStoreProducts,
  getStoreProductById,
  getStorePage,
  guestCheckout,
} = require('../controllers/storefront.controller');

router.get('/home', getHomeData);
router.get('/products', getStoreProducts);
router.get('/products/:id', getStoreProductById);
router.get('/pages/:slug', getStorePage);
router.post('/checkout', guestCheckout);

module.exports = router;
