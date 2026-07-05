const express = require('express');
const router = express.Router();
const {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  settlePayout,
  getVendorDashboard
} = require('../controllers/vendor.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

// Vendor Portal specific analytics route (must be before :id routes)
router.get('/portal/dashboard', protect, authorize('Vendor'), getVendorDashboard);

router.route('/')
  .get(protect, authorize('Admin', 'Super Admin', 'Staff'), getVendors)
  .post(protect, authorize('Admin', 'Super Admin'), createVendor);

router.route('/:id')
  .get(protect, authorize('Admin', 'Super Admin', 'Staff', 'Vendor'), getVendorById)
  .put(protect, authorize('Admin', 'Super Admin'), updateVendor)
  .delete(protect, authorize('Admin', 'Super Admin'), deleteVendor);

router.post('/:id/payouts', protect, authorize('Admin', 'Super Admin'), settlePayout);

module.exports = router;
