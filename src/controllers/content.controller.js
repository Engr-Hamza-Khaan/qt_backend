const { Page, WebsiteSetting } = require('../models');

// ==========================================
// PAGES (CMS) CONTROLLERS
// ==========================================

const createPage = async (req, res, next) => {
  try {
    const { title, slug, content, status, isSystemPage } = req.body;
    const page = await Page.create({ title, slug, content, status, isSystemPage });
    res.status(201).json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
};

const updatePage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = await Page.findByPk(id);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });

    await page.update(req.body);
    res.json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
};

const deletePage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = await Page.findByPk(id);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });

    if (page.isSystemPage) {
      return res.status(400).json({ success: false, message: 'System pages cannot be deleted' });
    }

    await page.destroy();
    res.json({ success: true, message: 'Page deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const getPages = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const pages = await Page.findAll({ where, order: [['title', 'ASC']] });
    res.json({ success: true, data: pages });
  } catch (error) {
    next(error);
  }
};

const getPageBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const page = await Page.findOne({ where: { slug } });
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });

    res.json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// WEBSITE CONFIGURATION / SETTINGS CONTROLLERS
// ==========================================

const updateSetting = async (req, res, next) => {
  try {
    const { key, value } = req.body;

    if (!key) return res.status(400).json({ success: false, message: 'Setting key required' });

    const [setting, created] = await WebsiteSetting.findOrCreate({
      where: { key },
      defaults: { value }
    });

    if (!created) {
      setting.value = value;
      await setting.save();
    }

    res.json({ success: true, message: `Setting '${key}' saved successfully`, data: setting });
  } catch (error) {
    next(error);
  }
};

const getSetting = async (req, res, next) => {
  try {
    const { key } = req.params;
    const setting = await WebsiteSetting.findOne({ where: { key } });

    if (!setting) {
      // Return a blank structure for convenience rather than 404
      return res.json({ success: true, data: { key, value: {} } });
    }

    res.json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
};

const getAllSettings = async (req, res, next) => {
  try {
    const settings = await WebsiteSetting.findAll();
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPage,
  updatePage,
  deletePage,
  getPages,
  getPageBySlug,

  updateSetting,
  getSetting,
  getAllSettings
};
