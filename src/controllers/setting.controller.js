const { WebsiteSetting } = require('../models');

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

module.exports = {
  getNotificationBarSetting,
  updateNotificationBarSetting,
  DEFAULT_NOTIFICATION_BAR,
  getTermsAndConditionsSetting,
  updateTermsAndConditionsSetting,
  DEFAULT_TERMS_AND_CONDITIONS,
};

