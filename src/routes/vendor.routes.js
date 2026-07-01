const express = require('express');
const router = express.Router();
const {
  getVendors,
  getVendorById,
  updateVendor,
  settlePayout,
  getVendorDashboard
} = require('../controllers/vendor.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

// Vendor Portal specific analytics route (must be before :id routes)
router.get('/portal/dashboard', protect, authorize('Vendor'), getVendorDashboard);

router.route('/')
  .get(protect, authorize('Admin', 'Super Admin', 'Staff'), getVendors);

router.route('/:id')
  .get(protect, authorize('Admin', 'Super Admin', 'Staff', 'Vendor'), getVendorById)
  .put(protect, authorize('Admin', 'Super Admin'), updateVendor);

router.post('/:id/payouts', protect, authorize('Admin', 'Super Admin'), settlePayout);

module.exports = router;
