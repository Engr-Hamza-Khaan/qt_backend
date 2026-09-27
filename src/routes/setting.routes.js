const express = require('express');
const router = express.Router();
const {
  getNotificationBarSetting,
  updateNotificationBarSetting,
  getTermsAndConditionsSetting,
  updateTermsAndConditionsSetting,
  getPopupSetting,
  updatePopupSetting,
  submitPopupLead,
  getLandingPageSetting,
  updateLandingPageSetting,
  getEmailSettingStatus,
  sendTestNotificationEmail,
} = require('../controllers/setting.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

router
  .route('/landing-page')
  .get(getLandingPageSetting)
  .put(protect, authorize('Admin', 'Super Admin', 'Staff'), updateLandingPageSetting);

router
  .route('/notification-bar')
  .get(getNotificationBarSetting)
  .put(protect, authorize('Admin', 'Super Admin', 'Staff'), updateNotificationBarSetting);

router
  .route('/terms-and-conditions')
  .get(getTermsAndConditionsSetting)
  .put(protect, authorize('Admin', 'Super Admin', 'Staff'), updateTermsAndConditionsSetting);

router
  .route('/popup')
  .get(getPopupSetting)
  .put(protect, authorize('Admin', 'Super Admin', 'Staff'), updatePopupSetting);

router
  .route('/popup/lead')
  .post(submitPopupLead);

router
  .route('/email/status')
  .get(protect, authorize('Admin', 'Super Admin'), getEmailSettingStatus);

router
  .route('/email/test')
  .post(protect, authorize('Admin', 'Super Admin'), sendTestNotificationEmail);

module.exports = router;

