const express = require('express');
const router = express.Router();
const {
  getNotificationBarSetting,
  updateNotificationBarSetting,
  getTermsAndConditionsSetting,
  updateTermsAndConditionsSetting,
} = require('../controllers/setting.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

router
  .route('/notification-bar')
  .get(getNotificationBarSetting)
  .put(protect, authorize('Admin', 'Super Admin', 'Staff'), updateNotificationBarSetting);

router
  .route('/terms-and-conditions')
  .get(getTermsAndConditionsSetting)
  .put(protect, authorize('Admin', 'Super Admin', 'Staff'), updateTermsAndConditionsSetting);

module.exports = router;

