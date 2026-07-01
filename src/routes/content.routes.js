const express = require('express');
const router = express.Router();
const {
  createPage,
  updatePage,
  deletePage,
  getPages,
  getPageBySlug,
  updateSetting,
  getSetting,
  getAllSettings
} = require('../controllers/content.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

// ==========================================
// PAGE (CMS) ROUTES
// ==========================================
router.route('/pages')
  .post(protect, authorize('Admin', 'Super Admin', 'Staff'), createPage)
  .get(getPages);

router.route('/pages/:id')
  .put(protect, authorize('Admin', 'Super Admin', 'Staff'), updatePage)
  .delete(protect, authorize('Admin', 'Super Admin'), deletePage);

router.get('/pages/slug/:slug', getPageBySlug);

// ==========================================
// SETTINGS CONFIG ROUTES
// ==========================================
router.route('/settings')
  .post(protect, authorize('Admin', 'Super Admin'), updateSetting)
  .get(protect, authorize('Admin', 'Super Admin', 'Staff'), getAllSettings);

router.get('/settings/:key', getSetting);

module.exports = router;
