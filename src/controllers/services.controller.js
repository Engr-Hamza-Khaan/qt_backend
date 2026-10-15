const { Op } = require('sequelize');
const { RepairRequest, SellRequest, ChatConversation, WebsiteSetting } = require('../models');

// ==========================================
// REPAIR REQUESTS MANAGEMENT
// ==========================================

const createRepairRequest = async (req, res, next) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      deviceType,
      deviceModel,
      issueType,
      serialNumber,
      accessoriesIncluded,
      preferredContact,
      priority,
      description,
      mediaUrls,
      estimatedCost
    } = req.body;

    const request = await RepairRequest.create({
      customerName,
      customerEmail,
      customerPhone,
      deviceType: deviceType || 'Console',
      deviceModel: deviceModel || null,
      issueType: issueType || null,
      serialNumber: serialNumber || null,
      accessoriesIncluded: accessoriesIncluded || null,
      preferredContact: preferredContact || 'Email',
      priority: priority || 'Normal',
      description,
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : (mediaUrls ? [mediaUrls] : []),
      estimatedCost: estimatedCost ? parseFloat(estimatedCost) : 0
    });

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

const getRepairRequests = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const where = {};
    if (status && status !== 'All') where.status = status;

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { customerName: { [Op.iLike]: q } },
        { customerEmail: { [Op.iLike]: q } },
        { customerPhone: { [Op.iLike]: q } },
        { deviceModel: { [Op.iLike]: q } },
        { issueType: { [Op.iLike]: q } },
        { description: { [Op.iLike]: q } },
      ];
    }

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

const deleteRepairRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await RepairRequest.findByPk(id);
    if (!request) return res.status(404).json({ success: false, message: 'Repair request not found' });

    await request.destroy();
    res.json({ success: true, message: 'Repair ticket deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// SELL REQUESTS & 30-DAY USED CONSOLE ADS MANAGEMENT
// ==========================================

const createSellRequest = async (req, res, next) => {
  try {
    const {
      customerName: rawCustomerName,
      name,
      customerEmail: rawCustomerEmail,
      email,
      customerPhone: rawCustomerPhone,
      phone,
      city,
      preferredContact,
      listingType = 'Used Console Ad',
      productName,
      title,
      platform,
      brand,
      variant,
      modelNumber,
      storage,
      color,
      edition,
      placement,
      condition,
      accessoriesIncluded,
      price,
      description,
      mediaUrls,
      embedMedia,
      tags,
      keywords,
      aliases
    } = req.body;

    const customerName = rawCustomerName || name;
    const customerEmail = rawCustomerEmail || email;
    const customerPhone = rawCustomerPhone || phone;

    const finalProductName = productName || title || `${brand || ''} ${platform || ''} ${variant || ''}`.trim() || 'Used Console';
    const now = new Date();
    // 30 days active duration for ad listings
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const request = await SellRequest.create({
      customerName,
      customerEmail,
      customerPhone,
      city: city || null,
      preferredContact: preferredContact || 'WhatsApp',
      listingType: listingType || 'Used Console Ad',
      productName: finalProductName,
      platform: platform || 'PS5',
      brand: brand || 'Sony',
      variant: variant || 'Slim',
      modelNumber: modelNumber || null,
      storage: storage || null,
      color: color || null,
      edition: edition || null,
      placement: placement || 'Horizontal',
      condition: condition || 'Used',
      accessoriesIncluded: accessoriesIncluded || null,
      price: price ? parseFloat(price) : null,
      description,
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
      embedMedia: embedMedia ? embedMedia.trim() : null,
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
      keywords: Array.isArray(keywords) ? keywords : (typeof keywords === 'string' ? keywords.split(',').map(k => k.trim()).filter(Boolean) : []),
      aliases: Array.isArray(aliases) ? aliases : (typeof aliases === 'string' ? aliases.split(',').map(a => a.trim()).filter(Boolean) : []),
      expiresAt,
      adStatus: 'Active',
      isAutoDisabled: false,
      status: 'Pending'
    });

    const plain = request.toJSON ? request.toJSON() : request;
    const daysRemaining = Math.max(0, Math.ceil((new Date(expiresAt) - now) / (1000 * 60 * 60 * 24)));

    res.status(201).json({
      success: true,
      message: 'Used console ad published successfully for 30 days.',
      data: {
        ...plain,
        daysRemaining,
        isExpired: false
      }
    });
  } catch (error) {
    next(error);
  }
};

const getSellRequests = async (req, res, next) => {
  try {
    const { status, adStatus, listingType, search } = req.query;
    const now = new Date();

    // Automatically auto-disable / mark expired any ads whose 30-day duration has ended
    await SellRequest.update(
      { adStatus: 'Expired', isAutoDisabled: true },
      {
        where: {
          adStatus: 'Active',
          expiresAt: { [Op.lt]: now }
        }
      }
    );

    const where = {};
    if (status) where.status = status;
    if (adStatus && adStatus !== 'All') where.adStatus = adStatus;
    if (listingType && listingType !== 'All') where.listingType = listingType;

    if (search) {
      const cleanSearch = `%${search.trim().toLowerCase()}%`;
      where[Op.or] = [
        { customerName: { [Op.iLike]: cleanSearch } },
        { customerEmail: { [Op.iLike]: cleanSearch } },
        { customerPhone: { [Op.iLike]: cleanSearch } },
        { productName: { [Op.iLike]: cleanSearch } },
        { platform: { [Op.iLike]: cleanSearch } },
        { modelNumber: { [Op.iLike]: cleanSearch } },
        { description: { [Op.iLike]: cleanSearch } }
      ];
    }

    const requests = await SellRequest.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    const decorated = requests.map(item => {
      const plain = item.toJSON ? item.toJSON() : item;
      const isExpired = plain.expiresAt ? new Date(plain.expiresAt) < now : false;
      const daysRemaining = plain.expiresAt
        ? Math.max(0, Math.ceil((new Date(plain.expiresAt) - now) / (1000 * 60 * 60 * 24)))
        : null;

      return {
        ...plain,
        isExpired,
        daysRemaining
      };
    });

    res.json({ success: true, count: decorated.length, data: decorated });
  } catch (error) {
    next(error);
  }
};

// Public endpoint for storefront buyers to view active 30-day Used Console ads
const getPublicUsedConsoleAds = async (req, res, next) => {
  try {
    const now = new Date();

    // Auto-disable expired ads
    await SellRequest.update(
      { adStatus: 'Expired', isAutoDisabled: true },
      {
        where: {
          adStatus: 'Active',
          expiresAt: { [Op.lt]: now }
        }
      }
    );

    const { platform, brand, search } = req.query;
    const where = {
      adStatus: 'Active',
      expiresAt: { [Op.gt]: now }
    };

    if (platform && platform !== 'All') {
      where.platform = { [Op.iLike]: `%${platform.trim()}%` };
    }
    if (brand && brand !== 'All') {
      where.brand = { [Op.iLike]: `%${brand.trim()}%` };
    }

    if (search) {
      const cleanSearch = `%${search.trim().toLowerCase()}%`;
      where[Op.or] = [
        { productName: { [Op.iLike]: cleanSearch } },
        { platform: { [Op.iLike]: cleanSearch } },
        { brand: { [Op.iLike]: cleanSearch } },
        { variant: { [Op.iLike]: cleanSearch } },
        { modelNumber: { [Op.iLike]: cleanSearch } },
        { description: { [Op.iLike]: cleanSearch } },
        { city: { [Op.iLike]: cleanSearch } }
      ];
    }

    const ads = await SellRequest.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    const decorated = ads.map(ad => {
      const plain = ad.toJSON ? ad.toJSON() : ad;
      const daysRemaining = Math.max(0, Math.ceil((new Date(plain.expiresAt) - now) / (1000 * 60 * 60 * 24)));
      return {
        ...plain,
        daysRemaining,
        isExpired: false
      };
    });

    res.json({ success: true, count: decorated.length, data: decorated });
  } catch (error) {
    next(error);
  }
};

const updateSellRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await SellRequest.findByPk(id);
    if (!request) return res.status(404).json({ success: false, message: 'Sell request not found' });

    const updateData = { ...req.body };

    // Action: Extend ad duration by 30 days
    if (req.body.action === 'extend_30_days') {
      const now = new Date();
      updateData.expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      updateData.adStatus = 'Active';
      updateData.isAutoDisabled = false;
      delete updateData.action;
    }

    // Action: Toggle disable/enable
    if (req.body.action === 'toggle_active') {
      if (request.adStatus === 'Active') {
        updateData.adStatus = 'Disabled';
      } else {
        const now = new Date();
        updateData.adStatus = 'Active';
        updateData.isAutoDisabled = false;
        // If it was expired, renew for 30 days
        if (!request.expiresAt || new Date(request.expiresAt) < now) {
          updateData.expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
      }
      delete updateData.action;
    }

    await request.update(updateData);

    const plain = request.toJSON ? request.toJSON() : request;
    const now = new Date();
    const isExpired = plain.expiresAt ? new Date(plain.expiresAt) < now : false;
    const daysRemaining = plain.expiresAt
      ? Math.max(0, Math.ceil((new Date(plain.expiresAt) - now) / (1000 * 60 * 60 * 24)))
      : null;

    res.json({
      success: true,
      message: 'Sell request / ad updated successfully',
      data: {
        ...plain,
        isExpired,
        daysRemaining
      }
    });
  } catch (error) {
    next(error);
  }
};

const deleteSellRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await SellRequest.findByPk(id);
    if (!request) return res.status(404).json({ success: false, message: 'Sell request not found' });

    await request.destroy();
    res.json({ success: true, message: 'Sell request / ad removed successfully' });
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
  deleteRepairRequest,

  createSellRequest,
  getSellRequests,
  getPublicUsedConsoleAds,
  updateSellRequest,
  deleteSellRequest,

  getChatConversations,
  getChatById,
  replyToChat,
  getChatSettings,
  getChatBySession,
  customerSendMessage
};
