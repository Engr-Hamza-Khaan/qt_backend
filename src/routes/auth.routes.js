const express = require('express');
const router = express.Router();
const { registerUser, registerVendor, loginUser, getUserProfile, updateUserProfile } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/register', registerUser);
router.post('/register-vendor', registerVendor);
router.post('/login', loginUser);

router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

module.exports = router;
