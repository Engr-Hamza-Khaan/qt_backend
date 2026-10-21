const express = require('express');
const router = express.Router();

// @route   GET /api/health
// @desc    Health check route
// @access  Public
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

module.exports = router;
