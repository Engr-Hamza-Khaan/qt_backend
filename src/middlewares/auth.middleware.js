const jwt = require('jsonwebtoken');
const { User, VendorProfile } = require('../models');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforquickturnecommerceadmin');

      req.user = await User.findByPk(decoded.id, {
        include: [{ model: VendorProfile, as: 'vendorProfile' }]
      });

      if (!req.user || !req.user.isActive) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found or inactive' });
      }

      next();
    } catch (error) {
      console.error('JWT Auth Error:', error);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

module.exports = { protect };
