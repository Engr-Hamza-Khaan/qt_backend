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
router.route('/chats')
  .get(protect, authorize('Admin', 'Super Admin', 'Staff'), getChatConversations);

router.route('/chats/:id')
  .get(protect, authorize('Admin', 'Super Admin', 'Staff'), getChatById)
  .post(protect, authorize('Admin', 'Super Admin', 'Staff'), replyToChat); // Admin reply

// Customer side chat socket/HTTP endpoint
router.post('/chats/message', customerSendMessage);

module.exports = router;
