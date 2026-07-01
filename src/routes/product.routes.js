const express = require('express');
const router = express.Router();
const {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
  addProduct,
  editProduct,
  deleteProduct,
  duplicateProduct,
  getProducts,
  getProductById,
  addVariation,
  updateVariation,
  deleteVariation,
  uploadProductMedia,
  deleteMedia,
  reorderMedia
} = require('../controllers/product.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const upload = require('../middlewares/upload.middleware');

// ==========================================
// CATEGORY ROUTES
// ==========================================
router.route('/categories')
  .post(protect, authorize('Admin', 'Super Admin'), createCategory)
  .get(getCategories);

router.route('/categories/:id')
  .put(protect, authorize('Admin', 'Super Admin'), updateCategory)
  .delete(protect, authorize('Admin', 'Super Admin'), deleteCategory);

// ==========================================
// PRODUCT ROUTES
// ==========================================
router.route('/')
  .post(protect, authorize('Admin', 'Super Admin', 'Vendor'), addProduct)
  .get(protect, authorize('Admin', 'Super Admin', 'Staff', 'Vendor'), getProducts);

router.route('/:id')
  .get(protect, authorize('Admin', 'Super Admin', 'Staff', 'Vendor'), getProductById)
  .put(protect, authorize('Admin', 'Super Admin', 'Vendor'), editProduct)
  .delete(protect, authorize('Admin', 'Super Admin', 'Vendor'), deleteProduct);

router.post('/:id/duplicate', protect, authorize('Admin', 'Super Admin', 'Vendor'), duplicateProduct);

// ==========================================
// VARIATION ROUTES
// ==========================================
router.post('/:productId/variations', protect, authorize('Admin', 'Super Admin', 'Vendor'), addVariation);

router.route('/variations/:variationId')
  .put(protect, authorize('Admin', 'Super Admin', 'Vendor'), updateVariation)
  .delete(protect, authorize('Admin', 'Super Admin', 'Vendor'), deleteVariation);

// ==========================================
// MEDIA ROUTES
// ==========================================
router.post('/:productId/media', protect, authorize('Admin', 'Super Admin', 'Vendor'), upload.single('file'), uploadProductMedia);
router.delete('/media/:mediaId', protect, authorize('Admin', 'Super Admin', 'Vendor'), deleteMedia);
router.put('/:productId/media/reorder', protect, authorize('Admin', 'Super Admin', 'Vendor'), reorderMedia);

module.exports = router;
