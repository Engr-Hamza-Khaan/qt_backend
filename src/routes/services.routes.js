const express = require('express');
const router = express.Router();
const {
  createRepairRequest,
  getRepairRequests,
  updateRepairRequest,
  deleteRepairRequest,
  createSellRequest,
  getSellRequests,
  updateSellRequest,
  getChatConversations,
  getChatById,
  replyToChat,
  getChatSettings,
  getChatBySession,
  customerSendMessage
} = require('../controllers/services.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const upload = require('../middlewares/upload.middleware');

// Public file/photo upload for repairs and service requests
router.post('/upload', (req, res, next) => {
  upload.array('files', 5)(req, res, (err) => {
    if (err) return next(err);
    const files = req.files || [];
    const fileUrls = files.map(f => `/uploads/${f.filename}`);
    res.json({
      success: true,
      fileUrls,
      fileUrl: fileUrls[0] || null
    });
  });
});

// ==========================================
// REPAIR SERVICES
// ==========================================
router.route('/repairs')
  .post(createRepairRequest) // Public customer intake
  .get(protect, authorize('Admin', 'Super Admin', 'Staff'), getRepairRequests);

router.route('/repairs/:id')
  .put(protect, authorize('Admin', 'Super Admin', 'Staff'), updateRepairRequest)
  .delete(protect, authorize('Admin', 'Super Admin'), deleteRepairRequest);

// ==========================================
// SELL / TRADE-IN SERVICES
// ==========================================
router.route('/sell')
  .post(createSellRequest) // Public customer trade-in
  .get(protect, authorize('Admin', 'Super Admin', 'Staff'), getSellRequests);

router.put('/sell/:id', protect, authorize('Admin', 'Super Admin', 'Staff'), updateSellRequest);

// ==========================================
// CHATBOT & CUSTOMER DIALOGUE
// ==========================================
// Public chatbot endpoints (must be before /chats/:id)
router.get('/chat-settings', getChatSettings);
router.get('/chats/session/:sessionId', getChatBySession);
router.post('/chats/message', customerSendMessage);

router.route('/chats')
  .get(protect, authorize('Admin', 'Super Admin', 'Staff'), getChatConversations);

router.route('/chats/:id')
  .get(protect, authorize('Admin', 'Super Admin', 'Staff'), getChatById)
  .post(protect, authorize('Admin', 'Super Admin', 'Staff'), replyToChat); // Admin reply

module.exports = router;
