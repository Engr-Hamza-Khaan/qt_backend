const express = require('express');
const router = express.Router();
const {
  getSearchSuggestions,
  getPopularSearchTerms,
  trackSearchQuery,
  getSearchAnalytics,
  createOrPinSearchTerm,
  togglePinSearchTerm,
  deleteSearchTerm,
} = require('../controllers/search.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

// Public Storefront Search Routes
router.get('/suggest', getSearchSuggestions);
router.get('/popular', getPopularSearchTerms);
router.post('/track', trackSearchQuery);

// Admin Analytics & Keyword Management Routes
router.get('/analytics', protect, authorize('Admin', 'Super Admin', 'Staff'), getSearchAnalytics);
router.post('/terms', protect, authorize('Admin', 'Super Admin'), createOrPinSearchTerm);
router.put('/terms/:id/pin', protect, authorize('Admin', 'Super Admin'), togglePinSearchTerm);
router.delete('/terms/:id', protect, authorize('Admin', 'Super Admin'), deleteSearchTerm);

module.exports = router;
