const express = require('express');
const router = express.Router();
const { getCustomers, getCustomerById, toggleCustomerStatus, deleteCustomer } = require('../controllers/customer.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

router.route('/')
  .get(protect, authorize('Admin', 'Super Admin', 'Staff'), getCustomers);

router.route('/:id')
  .get(protect, authorize('Admin', 'Super Admin', 'Staff'), getCustomerById)
  .delete(protect, authorize('Admin', 'Super Admin'), deleteCustomer);

router.put('/:id/status', protect, authorize('Admin', 'Super Admin'), toggleCustomerStatus);

module.exports = router;
