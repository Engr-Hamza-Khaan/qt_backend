const express = require('express');
const router = express.Router();
const {
  createRepairRequest,
  getRepairRequests,
  updateRepairRequest,
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

// ==========================================
// REPAIR SERVICES
// ==========================================
router.route('/repairs')
  .post(createRepairRequest) // Public customer intake
  .get(protect, authorize('Admin', 'Super Admin', 'Staff'), getRepairRequests);

router.put('/repairs/:id', protect, authorize('Admin', 'Super Admin', 'Staff'), updateRepairRequest);

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
