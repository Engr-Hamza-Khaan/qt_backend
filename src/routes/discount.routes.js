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

// Public checkout endpoint — must be before /:id routes
router.post('/validate', validateCoupon);

router.route('/')
  .post(protect, authorize('Admin', 'Super Admin'), createDiscount)
  .get(protect, authorize('Admin', 'Super Admin', 'Staff'), getDiscounts);

router.route('/:id')
  .put(protect, authorize('Admin', 'Super Admin'), updateDiscount)
  .delete(protect, authorize('Admin', 'Super Admin'), deleteDiscount);

module.exports = router;
