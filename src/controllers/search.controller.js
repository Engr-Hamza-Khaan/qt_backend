const { Op } = require('sequelize');
const { Product, ProductVariation, Category, Media, SearchTerm } = require('../models');

// Helper to sanitize product variations
const getLowestPrice = (variations = []) => {
  const active = variations.filter((v) => v.isActive);
  if (!active.length) return 0;
  return Math.min(...active.map((v) => parseFloat(v.price) || 0));
};

const getTotalStock = (variations = []) => {
  return variations.filter((v) => v.isActive).reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
};

const getFeaturedImage = (media = []) => {
  const feat = media.find((m) => m.isFeatured) || media[0];
  return feat ? feat.url : null;
};

// Normalize string for fuzzy/alias comparisons
const normalize = (str = '') =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// GET /api/store/search/suggest
const getSearchSuggestions = async (req, res, next) => {
  try {
    const { q = '', limit = 8 } = req.query;
    const query = q.trim();
    const queryLower = query.toLowerCase();
    const queryNorm = normalize(query);

    if (!query) {
      const popular = await SearchTerm.findAll({
        order: [
          ['isPinned', 'DESC'],
          ['searchCount', 'DESC'],
        ],
        limit: 6,
      });

      const categories = await Category.findAll({
        where: { parentId: null },
        attributes: ['id', 'name', 'slug', 'platform'],
        limit: 5,
      });

      return res.json({
        success: true,
        data: {
          products: [],
          totalMatches: 0,
          categories,
          popularSearches: popular.map((p) => p.term),
        },
      });
    }

    // Fetch all published products with variations, category & media
    const products = await Product.findAll({
      where: { status: 'Published' },
      include: [
        { model: ProductVariation, as: 'variations', where: { isActive: true }, required: false },
        { model: Media, as: 'media' },
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'platform'] },
      ],
    });

    const scoredProducts = [];

    for (const p of products) {
      let score = 0;
      let matchedReason = null;

      const titleLower = (p.title || '').toLowerCase();
      const titleNorm = normalize(p.title || '');
      const descLower = (p.description || '').toLowerCase();
      const modelLower = (p.modelNumber || '').toLowerCase();
      const categoryName = (p.category?.name || '').toLowerCase();
      const categoryPlatform = (p.category?.platform || '').toLowerCase();
      const productPlatform = (p.attributes?.platform || '').toLowerCase();

      const aliases = Array.isArray(p.aliases) ? p.aliases : [];
      const keywords = Array.isArray(p.keywords) ? p.keywords : [];
      const tags = Array.isArray(p.tags) ? p.tags : [];
      const variations = p.variations || [];

      // 1. Exact Title Match
      if (titleLower === queryLower || titleNorm === queryNorm) {
        score += 120;
        matchedReason = 'Exact Title Match';
      }
      // 2. Title Starts With Query
      else if (titleLower.startsWith(queryLower) || titleNorm.startsWith(queryNorm)) {
        score += 90;
        matchedReason = 'Product Name Match';
      }
      // 3. Title Contains Query Word / Substring
      else if (titleLower.includes(queryLower) || titleNorm.includes(queryNorm)) {
        score += 75;
        matchedReason = 'Product Name Match';
      }

      // 4. Aliases Match (Critical for RDR, GTA 5, COD BO6, PS5, XSX)
      for (const alias of aliases) {
        const aliasLower = (alias || '').toLowerCase();
        const aliasNorm = normalize(alias || '');
        if (aliasLower === queryLower || aliasNorm === queryNorm) {
          score += 115;
          matchedReason = `Alias: "${alias}"`;
          break;
        } else if (aliasLower.startsWith(queryLower) || aliasNorm.startsWith(queryNorm)) {
          score += 88;
          matchedReason = `Alias: "${alias}"`;
          break;
        } else if (aliasLower.includes(queryLower) || aliasNorm.includes(queryNorm)) {
          score += 70;
          matchedReason = `Alias: "${alias}"`;
          break;
        }
      }

      // 5. Keywords Match
      for (const kw of keywords) {
        const kwLower = (kw || '').toLowerCase();
        const kwNorm = normalize(kw || '');
        if (kwLower === queryLower || kwNorm === queryNorm) {
          score += 65;
          if (!matchedReason) matchedReason = `Keyword: "${kw}"`;
          break;
        } else if (kwLower.includes(queryLower) || kwNorm.includes(queryNorm)) {
          score += 55;
          if (!matchedReason) matchedReason = `Keyword: "${kw}"`;
          break;
        }
      }

      // 6. SKU & Variation Attributes Match (Color, Storage, Edition, Bundle, Condition)
      for (const v of variations) {
        const skuLower = (v.sku || '').toLowerCase();
        const colorLower = (v.color || '').toLowerCase();
        const storageLower = (v.storage || '').toLowerCase();
        const editionLower = (v.edition || '').toLowerCase();
        const bundleLower = (v.bundle || '').toLowerCase();
        const conditionLower = (v.condition || '').toLowerCase();

        if (skuLower === queryLower) {
          score += 60;
          if (!matchedReason) matchedReason = `SKU: ${v.sku}`;
          break;
        } else if (skuLower.includes(queryLower)) {
          score += 50;
          if (!matchedReason) matchedReason = `SKU: ${v.sku}`;
          break;
        } else if (storageLower === queryLower || storageLower.includes(queryLower)) {
          score += 46;
          if (!matchedReason) matchedReason = `Storage: ${v.storage}`;
          break;
        } else if (editionLower === queryLower || editionLower.includes(queryLower)) {
          score += 44;
          if (!matchedReason) matchedReason = `Edition: ${v.edition}`;
          break;
        } else if (bundleLower === queryLower || bundleLower.includes(queryLower)) {
          score += 44;
          if (!matchedReason) matchedReason = `Bundle: ${v.bundle}`;
          break;
        } else if (colorLower === queryLower || colorLower.includes(queryLower)) {
          score += 42;
          if (!matchedReason) matchedReason = `Color: ${v.color}`;
          break;
        } else if (conditionLower === queryLower) {
          score += 40;
          if (!matchedReason) matchedReason = `Condition: ${v.condition}`;
          break;
        }
      }

      // 7. Platform Match
      const variationPlatforms = variations.map((v) => (v.platform || '').toLowerCase());
      if (
        productPlatform === queryLower ||
        categoryPlatform === queryLower ||
        variationPlatforms.includes(queryLower)
      ) {
        score += 48;
        if (!matchedReason) matchedReason = `Platform: ${p.attributes?.platform || p.category?.platform || query.toUpperCase()}`;
      } else if (
        productPlatform.includes(queryLower) ||
        categoryPlatform.includes(queryLower) ||
        variationPlatforms.some((vp) => vp.includes(queryLower))
      ) {
        score += 40;
        if (!matchedReason) matchedReason = `Platform Match`;
      }

      // 8. Tags Match
      for (const tag of tags) {
        const tagLower = (tag || '').toLowerCase();
        if (tagLower === queryLower) {
          score += 45;
          if (!matchedReason) matchedReason = `Tag: "${tag}"`;
          break;
        } else if (tagLower.includes(queryLower)) {
          score += 35;
          if (!matchedReason) matchedReason = `Tag: "${tag}"`;
          break;
        }
      }

      // 9. Category Name Match
      if (categoryName === queryLower) {
        score += 42;
        if (!matchedReason) matchedReason = `Category: ${p.category.name}`;
      } else if (categoryName.includes(queryLower)) {
        score += 32;
        if (!matchedReason) matchedReason = `Category: ${p.category.name}`;
      }

      // 10. Model Number Match
      if (modelLower === queryLower) {
        score += 40;
        if (!matchedReason) matchedReason = `Model: ${p.modelNumber}`;
      } else if (modelLower.includes(queryLower)) {
        score += 30;
        if (!matchedReason) matchedReason = `Model: ${p.modelNumber}`;
      }

      // 11. Description Match
      if (descLower.includes(queryLower)) {
        score += 15;
        if (!matchedReason) matchedReason = 'Description Match';
      }

      // Bonus for featured / best seller items
      if (p.isFeatured) score += 3;
      if (p.isBestSeller) score += 2;

      if (score > 0) {
        scoredProducts.push({
          id: p.id,
          title: p.title,
          condition: p.condition,
          modelNumber: p.modelNumber,
          category: p.category,
          platform: p.attributes?.platform || p.category?.platform || variations[0]?.platform || null,
          price: getLowestPrice(variations),
          stockQuantity: getTotalStock(variations),
          inStock: getTotalStock(variations) > 0,
          featuredImage: getFeaturedImage(p.media),
          isFeatured: p.isFeatured,
          isBestSeller: p.isBestSeller,
          isFlashSale: p.isFlashSale,
          matchedReason: matchedReason || 'Keyword Match',
          score,
        });
      }
    }

    // Sort by relevance score DESC
    scoredProducts.sort((a, b) => b.score - a.score);

    // Matching Categories
    const matchingCategories = await Category.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { platform: { [Op.iLike]: `%${query}%` } },
        ],
      },
      attributes: ['id', 'name', 'slug', 'platform'],
      limit: 4,
    });

    // Popular Searches for recommendations
    const popularSearches = await SearchTerm.findAll({
      where: {
        term: { [Op.iLike]: `%${query}%` },
      },
      order: [['searchCount', 'DESC']],
      limit: 4,
    });

    res.json({
      success: true,
      data: {
        products: scoredProducts.slice(0, parseInt(limit, 10)),
        totalMatches: scoredProducts.length,
        categories: matchingCategories,
        popularSearches: popularSearches.map((s) => s.term),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/store/search/popular
const getPopularSearchTerms = async (req, res, next) => {
  try {
    const terms = await SearchTerm.findAll({
      order: [
        ['isPinned', 'DESC'],
        ['searchCount', 'DESC'],
      ],
      limit: 10,
    });

    // If DB is empty, supply rich default gaming search terms
    const defaultTerms = [
      'PlayStation 5',
      'GTA 5',
      'Red Dead Redemption',
      'DualSense Controller',
      'Call of Duty',
      'Nintendo Switch',
      'Spider-Man 2',
      'Black Myth Wukong',
    ];

    const result = terms.length ? terms.map((t) => t.term) : defaultTerms;

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// POST /api/store/search/track
const trackSearchQuery = async (req, res, next) => {
  try {
    const { term, resultsCount = 0 } = req.body;
    if (!term || !term.trim()) {
      return res.json({ success: true });
    }

    const cleanTerm = term.trim().toLowerCase();

    const [record, created] = await SearchTerm.findOrCreate({
      where: { term: cleanTerm },
      defaults: {
        term: cleanTerm,
        searchCount: 1,
        resultsCount: parseInt(resultsCount, 10) || 0,
        lastSearchedAt: new Date(),
      },
    });

    if (!created) {
      await record.update({
        searchCount: record.searchCount + 1,
        resultsCount: parseInt(resultsCount, 10) || record.resultsCount,
        lastSearchedAt: new Date(),
      });
    }

    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ADMIN SEARCH ANALYTICS CONTROLLERS
// ==========================================

// GET /api/admin/search/analytics
const getSearchAnalytics = async (req, res, next) => {
  try {
    const topSearches = await SearchTerm.findAll({
      order: [['searchCount', 'DESC']],
      limit: 25,
    });

    const zeroResultSearches = await SearchTerm.findAll({
      where: { resultsCount: 0 },
      order: [['searchCount', 'DESC']],
      limit: 15,
    });

    const totalSearches = await SearchTerm.sum('searchCount') || 0;
    const uniqueQueries = await SearchTerm.count();

    res.json({
      success: true,
      data: {
        totalSearches,
        uniqueQueries,
        topSearches,
        zeroResultSearches,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/search/terms
const createOrPinSearchTerm = async (req, res, next) => {
  try {
    const { term, isPinned = true } = req.body;
    if (!term || !term.trim()) {
      return res.status(400).json({ success: false, message: 'Search term is required' });
    }

    const cleanTerm = term.trim().toLowerCase();
    const [record, created] = await SearchTerm.findOrCreate({
      where: { term: cleanTerm },
      defaults: {
        term: cleanTerm,
        isPinned: !!isPinned,
        searchCount: 1,
        lastSearchedAt: new Date(),
      },
    });

    if (!created) {
      await record.update({ isPinned: !!isPinned });
    }

    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/search/terms/:id/pin
const togglePinSearchTerm = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await SearchTerm.findByPk(id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Search term not found' });
    }

    await record.update({ isPinned: !record.isPinned });
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/search/terms/:id
const deleteSearchTerm = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await SearchTerm.findByPk(id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Search term not found' });
    }

    await record.destroy();
    res.json({ success: true, message: 'Search term deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSearchSuggestions,
  getPopularSearchTerms,
  trackSearchQuery,
  getSearchAnalytics,
  createOrPinSearchTerm,
  togglePinSearchTerm,
  deleteSearchTerm,
};
