const express = require('express');
const router = express.Router();
const {
  createOrder,
  assignSupplier,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder
} = require('../controllers/order.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

router.route('/')
  .post(protect, createOrder)
  .get(protect, authorize('Admin', 'Super Admin', 'Staff', 'Vendor'), getOrders);

router.route('/:id')
  .get(protect, getOrderById)
  .put(protect, authorize('Admin', 'Super Admin', 'Staff'), updateOrderStatus)
  .delete(protect, authorize('Admin', 'Super Admin', 'Staff'), deleteOrder);

router.post('/:orderId/items/:itemId/assign-supplier', protect, authorize('Admin', 'Super Admin'), assignSupplier);

module.exports = router;
