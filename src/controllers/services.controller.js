const { RepairRequest, SellRequest, ChatConversation, WebsiteSetting } = require('../models');

// ==========================================
// REPAIR REQUESTS MANAGEMENT
// ==========================================

const createRepairRequest = async (req, res, next) => {
  try {
    const { customerName, customerEmail, customerPhone, description, mediaUrls } = req.body;
    const request = await RepairRequest.create({
      customerName,
      customerEmail,
      customerPhone,
      description,
      mediaUrls: mediaUrls || []
    });
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

const getRepairRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const requests = await RepairRequest.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    next(error);
  }
};

const updateRepairRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await RepairRequest.findByPk(id);
    if (!request) return res.status(404).json({ success: false, message: 'Repair request not found' });

    await request.update(req.body);
    res.json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// SELL REQUESTS MANAGEMENT
// ==========================================

const createSellRequest = async (req, res, next) => {
  try {
    const { customerName, customerEmail, customerPhone, productName, description, mediaUrls } = req.body;
    const request = await SellRequest.create({
      customerName,
      customerEmail,
      customerPhone,
      productName,
      description,
      mediaUrls: mediaUrls || []
    });
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

const getSellRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const requests = await SellRequest.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    next(error);
  }
};

const updateSellRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await SellRequest.findByPk(id);
    if (!request) return res.status(404).json({ success: false, message: 'Sell request not found' });

    await request.update(req.body);
    res.json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CHATBOT / LIVE CHAT MANAGEMENT
// ==========================================

const getChatConversations = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const chats = await ChatConversation.findAll({ where, order: [['updatedAt', 'DESC']] });
    res.json({ success: true, count: chats.length, data: chats });
  } catch (error) {
    next(error);
  }
};

const getChatById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const chat = await ChatConversation.findByPk(id);
    if (!chat) return res.status(404).json({ success: false, message: 'Conversation not found' });

    res.json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

// Admin replies to a chat conversation
const replyToChat = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    const chat = await ChatConversation.findByPk(id);
    if (!chat) return res.status(404).json({ success: false, message: 'Conversation not found' });

    // Append message
    const currentMessages = [...chat.messages];
    currentMessages.push({
      sender: 'agent',
      text,
      timestamp: new Date()
    });

    chat.messages = currentMessages;
    chat.assignedTo = req.user.id; // Assign to the responding admin
    await chat.save();

    res.json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

const DEFAULT_BUSINESS_HOURS = {
  monday: { enabled: true, open: '09:00', close: '18:00' },
  tuesday: { enabled: true, open: '09:00', close: '18:00' },
  wednesday: { enabled: true, open: '09:00', close: '18:00' },
  thursday: { enabled: true, open: '09:00', close: '18:00' },
  friday: { enabled: true, open: '09:00', close: '18:00' },
  saturday: { enabled: true, open: '10:00', close: '16:00' },
  sunday: { enabled: false, open: '09:00', close: '18:00' },
};

const getChatSettings = async (req, res, next) => {
  try {
    const [welcomeSetting, hoursSetting] = await Promise.all([
      WebsiteSetting.findOne({ where: { key: 'chatbot_welcome_message' } }),
      WebsiteSetting.findOne({ where: { key: 'chatbot_business_hours' } }),
    ]);

    const hoursValue = hoursSetting?.value || {};

    res.json({
      success: true,
      data: {
        welcomeMessage:
          welcomeSetting?.value?.text ||
          'Hello! How can we assist you today?',
        businessHoursDisplay:
          hoursValue.display ||
          'Mon–Fri 9am–6pm, Sat 10am–4pm',
        offlineMessage:
          hoursValue.offlineMessage ||
          "We're currently offline. Leave us a message and we'll respond during business hours.",
        schedule: hoursValue.schedule || DEFAULT_BUSINESS_HOURS,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getChatBySession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const chat = await ChatConversation.findOne({ where: { customerSessionId: sessionId } });

    if (!chat) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

// Customer writes to the chat (interacts with Bot or Agent)
const customerSendMessage = async (req, res, next) => {
  try {
    const { customerSessionId, text, customerName, customerEmail } = req.body;

    const [chat, created] = await ChatConversation.findOrCreate({
      where: { customerSessionId },
      defaults: {
        customerName,
        customerEmail,
        messages: []
      }
    });

    const currentMessages = [...chat.messages];
    currentMessages.push({
      sender: 'customer',
      text,
      timestamp: new Date()
    });

    // If chat is new, append Bot welcome message
    if (created) {
      const welcomeSetting = await WebsiteSetting.findOne({ where: { key: 'chatbot_welcome_message' } });
      const welcomeText = welcomeSetting?.value?.text || 'Hello! How can we assist you today?';
      currentMessages.push({
        sender: 'bot',
        text: welcomeText,
        timestamp: new Date()
      });
    } else {
      // Simulate simple bot replies if no agent is assigned yet
      if (!chat.assignedTo) {
        currentMessages.push({
          sender: 'bot',
          text: "Thanks for your message! Our team is reviewing this and will get back to you shortly.",
          timestamp: new Date()
        });
      }
    }

    chat.messages = currentMessages;
    chat.status = 'Open';
    await chat.save();

    res.json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
