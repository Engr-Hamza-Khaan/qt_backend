const express = require('express');
const router = express.Router();
const {
  createDiscount,
  updateDiscount,
  deleteDiscount,
  getDiscounts,
  validateCoupon
} = require('../controllers/discount.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

router.route('/')
  .post(protect, authorize('Admin', 'Super Admin'), createDiscount)
  .get(protect, authorize('Admin', 'Super Admin', 'Staff'), getDiscounts);

router.route('/:id')
  .put(protect, authorize('Admin', 'Super Admin'), updateDiscount)
  .delete(protect, authorize('Admin', 'Super Admin'), deleteDiscount);

// Public/Checkout endpoint to apply coupon code
router.post('/validate', validateCoupon);

module.exports = router;
