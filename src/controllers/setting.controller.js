const { WebsiteSetting } = require('../models');
const { verifySmtpConnection, sendTestEmail } = require('../utils/email.service');

const DEFAULT_NOTIFICATION_BAR = {
  active: true,
  text: '🚚 Free shipping on orders over Rs 150! | Summer Sale Active Now!',
  link: '/shop',
  linkText: 'Shop Deals',
  preset: 'neon-purple',
  customBg: '#7c16c9',
  textColor: '#ffffff',
  dismissable: true,
  showInAdmin: true,
  icon: 'truck',
  placement: 'top',
};

// GET /api/settings/notification-bar
const getNotificationBarSetting = async (req, res, next) => {
  try {
    const setting = await WebsiteSetting.findOne({
      where: { key: 'notification_bar' },
    });

    if (!setting) {
      return res.json({
        success: true,
        data: DEFAULT_NOTIFICATION_BAR,
      });
    }

    // Merge defaults with stored setting value to guarantee all fields exist
    const value = {
      ...DEFAULT_NOTIFICATION_BAR,
      ...(setting.value || {}),
    };

    res.json({
      success: true,
      data: value,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/settings/notification-bar
const updateNotificationBarSetting = async (req, res, next) => {
  try {
    const {
      active,
      text,
      link,
      linkText,
      preset,
      customBg,
      textColor,
      dismissable,
      showInAdmin,
      icon,
      placement,
    } = req.body;

    const newPayload = {
      active: active !== undefined ? Boolean(active) : true,
      text: text !== undefined ? String(text) : '',
      link: link !== undefined ? String(link) : '',
      linkText: linkText !== undefined ? String(linkText) : '',
      preset: preset || 'neon-purple',
      customBg: customBg || '#7c16c9',
      textColor: textColor || '#ffffff',
      dismissable: dismissable !== undefined ? Boolean(dismissable) : true,
      showInAdmin: showInAdmin !== undefined ? Boolean(showInAdmin) : true,
      icon: icon || 'truck',
      placement: placement || 'top',
    };

    let setting = await WebsiteSetting.findOne({
      where: { key: 'notification_bar' },
    });

    if (setting) {
      setting.value = newPayload;
      await setting.save();
    } else {
      setting = await WebsiteSetting.create({
        key: 'notification_bar',
        value: newPayload,
      });
    }

    res.json({
      success: true,
      message: 'Notification bar settings updated successfully',
      data: setting.value,
    });
  } catch (error) {
    next(error);
  }
};

const DEFAULT_TERMS_AND_CONDITIONS = {
  title: 'Terms & Conditions',
  subtitle: 'Please review the policies governing purchases, console repairs, trade-ins, and services at Quickturn.',
  lastUpdated: 'August 2026',
  bannerBadge: 'Quickturn Gaming Policies',
  sections: [
    {
      id: 'acceptance',
      heading: '1. Acceptance of Agreement',
      content: 'By accessing our website, browsing products, submitting orders, or requesting console repair and trade-in services, you agree to comply with and be bound by these Terms and Conditions along with our privacy policies.'
    },
    {
      id: 'orders_payments',
      heading: '2. Orders, Pricing & Payment Methods',
      content: 'All product prices are quoted in PKR (Pakistani Rupee) and are subject to change without prior notice. We accept Cash on Delivery (COD) and direct Bank Transfers. Orders are subject to item availability and confirmation. Quickturn reserves the right to decline or cancel orders due to pricing errors or inventory discrepancies.'
    },
    {
      id: 'shipping_delivery',
      heading: '3. Shipping, Delivery & Tracking',
      content: 'We provide nationwide delivery across Pakistan through reliable courier services. Orders are typically processed and delivered within 2-4 business days. Real-time tracking information is communicated once the consignment is dispatched. Customers must inspect packages upon arrival and notify us immediately of any transit damage.'
    },
    {
      id: 'repair_services',
      heading: '4. Console Repair & Diagnostic Services',
      content: 'Consoles and accessories submitted for repair undergo preliminary diagnostics. Pre-existing issues, prior unauthorized repairs, or liquid damage must be disclosed beforehand. We offer a 30-day service warranty on components replaced during repair. Damages caused by electrical surges, misuse, or tampering after repair are excluded from warranty.'
    },
    {
      id: 'sell_tradein',
      heading: '5. Sell & Trade-in Policy',
      content: 'Valuations provided through our online estimation form are provisional. The final trade-in value or cash payout is confirmed after technical inspection and grading at our facility. All trade-in devices must belong to the seller and must not be blacklisted, iCloud-locked, or reported lost/stolen.'
    },
    {
      id: 'warranty_returns',
      heading: '6. Warranty, Replacements & Returns',
      content: 'Brand new hardware items include standard official warranty coverage or a 7-day initial replacement warranty for manufacturing defects. Pre-owned items include a 7-day checking warranty. Items must be returned in their original packaging with all included accessories. Physical damage or water intrusion voids warranty.'
    },
    {
      id: 'custom_3d',
      heading: '7. Custom 3D Figures & Bespoke Mods',
      content: 'Custom 3D figures and personalized modding requests are built to individual specifications. Production begins following order confirmation and upfront deposit. Because these are custom-made items, orders cannot be cancelled or refunded once production has begun.'
    },
    {
      id: 'liability',
      heading: '8. Limitation of Liability',
      content: 'Quickturn shall not be held liable for indirect, incidental, or consequential damages resulting from product misuse, ungrounded household power issues, or third-party courier delays.'
    }
  ],
  contactEmail: 'info@quickturn.pk',
  contactPhone: '+92 300 1234567',
  contactAddress: 'Karachi, Sindh, Pakistan'
};

// GET /api/settings/terms-and-conditions
const getTermsAndConditionsSetting = async (req, res, next) => {
  try {
    const setting = await WebsiteSetting.findOne({
      where: { key: 'terms_and_conditions' },
    });

    if (!setting) {
      return res.json({
        success: true,
        data: DEFAULT_TERMS_AND_CONDITIONS,
      });
    }

    const value = {
      ...DEFAULT_TERMS_AND_CONDITIONS,
      ...(setting.value || {}),
    };

    res.json({
      success: true,
      data: value,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/settings/terms-and-conditions
const updateTermsAndConditionsSetting = async (req, res, next) => {
  try {
    const {
      title,
      subtitle,
      lastUpdated,
      bannerBadge,
      sections,
      contactEmail,
      contactPhone,
      contactAddress,
    } = req.body;

    const newPayload = {
      title: title ? String(title).trim() : DEFAULT_TERMS_AND_CONDITIONS.title,
      subtitle: subtitle !== undefined ? String(subtitle).trim() : DEFAULT_TERMS_AND_CONDITIONS.subtitle,
      lastUpdated: lastUpdated ? String(lastUpdated).trim() : DEFAULT_TERMS_AND_CONDITIONS.lastUpdated,
      bannerBadge: bannerBadge !== undefined ? String(bannerBadge).trim() : DEFAULT_TERMS_AND_CONDITIONS.bannerBadge,
      sections: Array.isArray(sections) ? sections : DEFAULT_TERMS_AND_CONDITIONS.sections,
      contactEmail: contactEmail ? String(contactEmail).trim() : DEFAULT_TERMS_AND_CONDITIONS.contactEmail,
      contactPhone: contactPhone ? String(contactPhone).trim() : DEFAULT_TERMS_AND_CONDITIONS.contactPhone,
      contactAddress: contactAddress ? String(contactAddress).trim() : DEFAULT_TERMS_AND_CONDITIONS.contactAddress,
    };

    let setting = await WebsiteSetting.findOne({
      where: { key: 'terms_and_conditions' },
    });

    if (setting) {
      setting.value = newPayload;
      await setting.save();
    } else {
      setting = await WebsiteSetting.create({
        key: 'terms_and_conditions',
        value: newPayload,
      });
    }

    res.json({
      success: true,
      message: 'Terms & Conditions updated successfully',
      data: setting.value,
    });
  } catch (error) {
    next(error);
  }
};

const DEFAULT_POPUP_SETTING = {
  active: true,
  title: '⚡ SPECIAL FLASH OFFER: UP TO 25% OFF!',
  subtitle: 'Upgrade your gaming rig, consoles, and controllers today! Use discount code at checkout.',
  badge: '🔥 LIMITED TIME DEAL',
  couponCode: 'QUICKTURN25',
  imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
  presetTheme: 'neon-purple',
  customBg: '#120d24',
  textColor: '#ffffff',
  accentColor: '#a855f7',
  position: 'center', // 'center', 'bottom-right', 'bottom-left'
  animation: 'scale-up', // 'scale-up', 'fade-in', 'slide-up'

  // Trigger & Timing
  triggerType: 'delay', // 'immediate', 'delay', 'scroll', 'exit_intent'
  delaySeconds: 4,
  scrollPercentage: 35,

  // Duration & Frequency
  autoClose: false,
  autoCloseSeconds: 15,
  frequency: 'once_per_session', // 'always', 'once_per_session', 'once_per_day'

  // Visitor Action behavior
  actionType: 'copy_coupon', // 'copy_coupon', 'redirect', 'newsletter', 'custom_success'
  buttonText: 'Claim 25% Discount Now',
  buttonLink: '/shop',
  secondaryButtonText: 'Maybe Later',

  // Success Feedback
  successTitle: '🎉 Discount Code Applied!',
  successMessage: 'Code QUICKTURN25 has been copied to your clipboard. Enjoy your shopping!',
  successButtonText: 'Start Shopping Now',
  successButtonLink: '/shop',

  leads: [],
};

// GET /api/settings/popup
const getPopupSetting = async (req, res, next) => {
  try {
    const setting = await WebsiteSetting.findOne({
      where: { key: 'website_popup' },
    });

    if (!setting) {
      return res.json({
        success: true,
        data: DEFAULT_POPUP_SETTING,
      });
    }

    const value = {
      ...DEFAULT_POPUP_SETTING,
      ...(setting.value || {}),
    };

    res.json({
      success: true,
      data: value,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/settings/popup
const updatePopupSetting = async (req, res, next) => {
  try {
    const payload = req.body;

    let setting = await WebsiteSetting.findOne({
      where: { key: 'website_popup' },
    });

    const existingLeads = setting?.value?.leads || [];

    const newPayload = {
      ...DEFAULT_POPUP_SETTING,
      ...(setting ? setting.value : {}),
      ...payload,
      // preserve collected leads unless explicitly updated
      leads: Array.isArray(payload.leads) ? payload.leads : existingLeads,
    };

    if (setting) {
      setting.value = newPayload;
      await setting.save();
    } else {
      setting = await WebsiteSetting.create({
        key: 'website_popup',
        value: newPayload,
      });
    }

    res.json({
      success: true,
      message: 'Website popup settings updated successfully',
      data: setting.value,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/settings/popup/lead (collects newsletter email or subscriber from popup)
const submitPopupLead = async (req, res, next) => {
  try {
    const { email, phone, name } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required',
      });
    }

    let setting = await WebsiteSetting.findOne({
      where: { key: 'website_popup' },
    });

    const currentVal = setting?.value || DEFAULT_POPUP_SETTING;
    const leads = Array.isArray(currentVal.leads) ? [...currentVal.leads] : [];

    const newLead = {
      id: `lead-${Date.now()}`,
      email: email ? String(email).trim().toLowerCase() : '',
      phone: phone ? String(phone).trim() : '',
      name: name ? String(name).trim() : '',
      submittedAt: new Date().toISOString(),
    };

    // Prevent duplicate email entry in leads
    const exists = leads.some((l) => l.email && l.email === newLead.email);
    if (!exists) {
      leads.unshift(newLead);
      if (setting) {
        setting.value = {
          ...currentVal,
          leads,
        };
        await setting.save();
      } else {
        await WebsiteSetting.create({
          key: 'website_popup',
          value: {
            ...DEFAULT_POPUP_SETTING,
            leads,
          },
        });
      }
    }

    res.json({
      success: true,
      message: 'Thank you! Your submission has been received.',
      data: { couponCode: currentVal.couponCode },
    });
  } catch (error) {
    next(error);
  }
};

const DEFAULT_LANDING_PAGE = {
  sectionsOrder: [
    { id: 'hero', label: 'Hero Section & Platforms', enabled: true },
    { id: 'trust', label: 'Trust & Feature Badges', enabled: true },
    { id: 'newArrivals', label: 'New Arrivals Products', enabled: true },
    { id: 'flashSale', label: 'Flash Deals Products', enabled: true },
    { id: 'featured', label: 'Featured Products', enabled: true },
    { id: 'promoBanner', label: 'Promotional Mid-Banner', enabled: true },
    { id: 'bestSellers', label: 'Best Sellers Products', enabled: true },
    { id: 'sellCta', label: 'Sell / Trade-in Banner', enabled: true },
  ],
  hero: {
    badge: '• CERTIFIED • TESTED • READY TO SHIP',
    headline1: 'CONSOLE YOU',
    headline2: 'WANT,',
    headlineHollow: 'READY TO PLAY.',
    subtitle: 'Every console is inspected, stress-tested, and backed by a 90-day warranty before it reaches your door. Trade in your old gear anytime.',
    shopBtnText: 'Shop Console',
    shopBtnLink: '/shop?categorySlug=consoles',
    sellBtnText: 'Sell Your Console',
    sellBtnLink: '/sell',
    platforms: [
      {
        id: 'xbox',
        label: 'XBOX SERIES',
        name: 'Xbox Series X & S',
        image: '/Xbox Both.png',
        alt: 'Xbox Series X and Series S Consoles',
        activeColor: 'text-[#107c10]',
        glowColor: 'from-[#107c10]/40 via-[#107c10]/20 to-transparent',
        ambientGlow: 'bg-[#107c10]/30',
        shopLink: '/shop?categorySlug=consoles&search=xbox',
        sellLink: '/sell',
      },
      {
        id: 'playstation',
        label: 'PLAYSTATION',
        name: 'PlayStation 5 Slim',
        image: '/SLim.png',
        alt: 'PlayStation 5 Slim Console',
        activeColor: 'text-[#0070d1]',
        glowColor: 'from-[#0070d1]/45 via-[#0070d1]/25 to-transparent',
        ambientGlow: 'bg-[#0070d1]/35',
        shopLink: '/shop?categorySlug=consoles&search=playstation',
        sellLink: '/sell',
      },
      {
        id: 'nintendo',
        label: 'NINTENDO SWITCH',
        name: 'Nintendo Switch OLED',
        image: '/Nintendo PNG.png',
        alt: 'Nintendo Switch Console',
        activeColor: 'text-[#e60012]',
        glowColor: 'from-[#e60012]/45 via-[#e60012]/20 to-transparent',
        ambientGlow: 'bg-[#e60012]/35',
        shopLink: '/shop?categorySlug=consoles&search=nintendo',
        sellLink: '/sell',
      },
    ],
  },
  trustBar: [
    { icon: 'shield', title: 'Genuine Products', desc: '100% authentic warranty' },
    { icon: 'truck', title: 'Fast Delivery', desc: 'Nationwide shipping' },
    { icon: 'rotate', title: 'Easy Returns', desc: '7-day return policy' },
    { icon: 'headphones', title: 'Expert Support', desc: 'WhatsApp & phone help' },
  ],
  productHeadings: {
    newArrivals: {
      title: 'New Arrivals',
      subtitle: 'Latest products added to the store',
      viewAllText: 'View All',
      viewAllLink: '/shop',
    },
    flashSale: {
      title: 'Flash Deals',
      subtitle: "Limited time offers — grab them before they're gone",
      viewAllText: 'View All',
      viewAllLink: '/shop?flashSale=true',
    },
    featured: {
      title: 'Featured Products',
      subtitle: 'Hand-picked premium picks for you',
      viewAllText: 'View All',
      viewAllLink: '/shop?featured=true',
    },
    bestSellers: {
      title: 'Best Sellers',
      subtitle: 'Most popular products this month',
      viewAllText: 'View All',
      viewAllLink: '/shop',
    },
  },
  promoBanner: {
    show: true,
    title: 'Level Up Your Gaming Setup',
    subtitle: 'Exclusive deals on pro gaming controllers, headsets, and 4K displays.',
    buttonText: 'Shop Collection',
    buttonLink: '/shop',
    badge: 'EXCLUSIVE DEALS',
  },
  sellCta: {
    title: 'Have a console or game to sell?',
    subtitle: 'Get an instant quote for your used console, games, or gaming gear',
    buttonText: 'Get a Quote',
    buttonLink: '/sell',
  },
};

// GET /api/settings/landing-page
const getLandingPageSetting = async (req, res, next) => {
  try {
    const setting = await WebsiteSetting.findOne({
      where: { key: 'landing_page' },
    });

    if (!setting) {
      return res.json({
        success: true,
        data: DEFAULT_LANDING_PAGE,
      });
    }

    const value = {
      ...DEFAULT_LANDING_PAGE,
      ...(setting.value || {}),
      hero: {
        ...DEFAULT_LANDING_PAGE.hero,
        ...(setting.value?.hero || {}),
      },
      productHeadings: {
        ...DEFAULT_LANDING_PAGE.productHeadings,
        ...(setting.value?.productHeadings || {}),
      },
      promoBanner: {
        ...DEFAULT_LANDING_PAGE.promoBanner,
        ...(setting.value?.promoBanner || {}),
      },
      sellCta: {
        ...DEFAULT_LANDING_PAGE.sellCta,
        ...(setting.value?.sellCta || {}),
      },
    };

    res.json({
      success: true,
      data: value,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/settings/landing-page
const updateLandingPageSetting = async (req, res, next) => {
  try {
    const payload = req.body;

    let setting = await WebsiteSetting.findOne({
      where: { key: 'landing_page' },
    });

    const newPayload = {
      ...DEFAULT_LANDING_PAGE,
      ...(setting ? setting.value : {}),
      ...payload,
    };

    if (setting) {
      setting.value = newPayload;
      await setting.save();
    } else {
      setting = await WebsiteSetting.create({
        key: 'landing_page',
        value: newPayload,
      });
    }

    res.json({
      success: true,
      message: 'Landing page customization saved successfully',
      data: setting.value,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/settings/email/status
const getEmailSettingStatus = async (req, res, next) => {
  try {
    const smtpStatus = await verifySmtpConnection();
    res.json({
      success: true,
      data: {
        smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
        smtpPort: parseInt(process.env.SMTP_PORT || '465', 10),
        smtpUser: process.env.SMTP_USER || 'quickturnpk@gmail.com',
        fromName: process.env.SMTP_FROM_NAME || 'QuickTurn',
        fromEmail: process.env.SMTP_FROM_EMAIL || 'quickturnpk@gmail.com',
        adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'quickturnpk@gmail.com',
        connection: smtpStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/settings/email/test
const sendTestNotificationEmail = async (req, res, next) => {
  try {
    const { toEmail } = req.body;
    const recipient = toEmail || process.env.ADMIN_NOTIFICATION_EMAIL || 'quickturnpk@gmail.com';
    const info = await sendTestEmail(recipient);
    res.json({
      success: true,
      message: `Test email dispatched to ${recipient}`,
      messageId: info.messageId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      isAuthError: error.message?.includes('535') || error.code === 'EAUTH',
      help: error.message?.includes('535')
        ? 'Gmail requires an App Password (16 characters) instead of standard account password. Visit https://myaccount.google.com/apppasswords to generate one.'
        : undefined,
    });
  }
};

module.exports = {
  getNotificationBarSetting,
  updateNotificationBarSetting,
  DEFAULT_NOTIFICATION_BAR,
  getTermsAndConditionsSetting,
  updateTermsAndConditionsSetting,
  DEFAULT_TERMS_AND_CONDITIONS,
  getPopupSetting,
  updatePopupSetting,
  submitPopupLead,
  DEFAULT_POPUP_SETTING,
  getLandingPageSetting,
  updateLandingPageSetting,
  DEFAULT_LANDING_PAGE,
  getEmailSettingStatus,
  sendTestNotificationEmail,
};

