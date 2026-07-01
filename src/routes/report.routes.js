const express = require('express');
const router = express.Router();
const { getDashboardSummary, getFinancialReport } = require('../controllers/report.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

router.get('/dashboard', protect, authorize('Admin', 'Super Admin', 'Staff'), getDashboardSummary);
router.get('/financial', protect, authorize('Admin', 'Super Admin'), getFinancialReport);

module.exports = router;
