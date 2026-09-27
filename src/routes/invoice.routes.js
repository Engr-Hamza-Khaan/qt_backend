const express = require('express');
const router = express.Router();
const {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getNextInvoiceNumber,
  createFromOrder,
} = require('../controllers/invoice.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

router.use(protect);

router
  .route('/')
  .get(authorize('Admin', 'Super Admin', 'Staff'), getAllInvoices)
  .post(authorize('Admin', 'Super Admin', 'Staff'), createInvoice);

router
  .route('/next-number')
  .get(authorize('Admin', 'Super Admin', 'Staff'), getNextInvoiceNumber);

router
  .route('/from-order/:orderId')
  .post(authorize('Admin', 'Super Admin', 'Staff'), createFromOrder);

router
  .route('/:id')
  .get(authorize('Admin', 'Super Admin', 'Staff'), getInvoiceById)
  .put(authorize('Admin', 'Super Admin', 'Staff'), updateInvoice)
  .delete(authorize('Admin', 'Super Admin', 'Staff'), deleteInvoice);

module.exports = router;
