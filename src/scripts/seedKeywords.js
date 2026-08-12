require('dotenv').config();
const { sequelize, Product, ProductVariation, Category, SearchTerm } = require('../models');

const CATALOG_ENRICHMENTS = [
  {
    titleMatch: 'PlayStation 5 Console',
    aliases: ['PS5', 'PS5 Console', 'PlayStation 5', 'PS 5', 'PlayStation', 'Sony PS5'],
    keywords: ['next gen', 'sony', '4k', '8k', 'ray tracing', 'disc edition', 'digital edition', 'console', 'gaming', 'playstation'],
  },
  {
    titleMatch: 'DualSense Wireless Controller',
    aliases: ['DualSense', 'PS5 Controller', 'Dual Sense', 'PS5 Gamepad', 'Sony Controller', 'PS5 Pad'],
    keywords: ['haptic feedback', 'adaptive triggers', 'controller', 'gamepad', 'wireless', 'accessories', 'joystick', 'midnight black'],
  },
  {
    titleMatch: 'Super Mario Bros',
    aliases: ['Mario', 'SMB', 'Super Mario', 'NES Mario', 'Mario Bros', 'Retro Mario'],
    keywords: ['nintendo', 'nes', 'vintage', 'classic', 'platformer', 'retro', 'cartridge'],
  },
  {
    titleMatch: 'Astro Bot',
    aliases: ['Astrobot', 'Astro', 'Team Asobi', 'Astro Bot PS5'],
    keywords: ['platformer', 'adventure', 'bot', 'dualsense', 'family', 'playstation exclusive', 'game of the year'],
  },
  {
    titleMatch: 'Battlefield 6',
    aliases: ['BF6', 'Battlefield', 'BF 6', 'Battlefield 2025'],
    keywords: ['fps', 'shooter', 'multiplayer', 'warfare', 'frostbite', 'all out war', 'ea games'],
  },
  {
    titleMatch: 'Black Myth: Wukong',
    aliases: ['BMW', 'Wukong', 'Black Myth', 'Monkey King', 'Black Myth Wukong'],
    keywords: ['action rpg', 'souls like', 'chinese mythology', 'journey to the west', 'staff', 'destined one'],
  },
  {
    titleMatch: 'EA Sports FC 26',
    aliases: ['FC 26', 'FIFA 26', 'FC26', 'FIFA', 'EA FC 26', 'EA FC'],
    keywords: ['football', 'soccer', 'ultimate team', 'career mode', 'ea sports', 'sports game', 'hypermotion'],
  },
  {
    titleMatch: 'Ghost of Yōtei',
    aliases: ['GOY', 'Ghost of Yotei', 'Ghost of Tsushima 2', 'Yotei', 'Ghost 2'],
    keywords: ['samurai', 'open world', 'action', 'japan', 'sucker punch', 'katana', 'mount yotei', 'sword'],
  },
  {
    titleMatch: 'Marvel\'s Spider-Man 2',
    aliases: ['Spider-Man 2', 'Spiderman 2', 'SM2', 'Spider Man 2', 'Spiderman', 'Miles Morales'],
    keywords: ['superhero', 'marvel', 'peter parker', 'venom', 'kraven', 'insomniac', 'swinging', 'action'],
  },
  {
    titleMatch: 'The Last of Us Part II Remastered',
    aliases: ['TLOU2', 'TLOU 2', 'The Last of Us 2', 'TLOU', 'Last of Us 2', 'Last of Us Remastered'],
    keywords: ['ellie', 'abby', 'survival', 'post apocalyptic', 'naughty dog', 'zombies', 'clickers', 'story driven', 'no return'],
  },
  {
    titleMatch: 'Red Dead Redemption',
    aliases: ['RDR', 'RDR1', 'Red Dead', 'Red Dead 1', 'RDR 1', 'John Marston'],
    keywords: ['rockstar', 'wild west', 'cowboy', 'outlaw', 'open world', 'western', 'horses', 'gunslinger'],
  },
  {
    titleMatch: 'Grand Theft Auto V',
    aliases: ['GTA V', 'GTA 5', 'Grand Theft Auto 5', 'GTA5', 'GTAV', 'Los Santos'],
    keywords: ['rockstar', 'heist', 'open world', 'crime', 'michael', 'franklin', 'trevor', 'cars', 'online', 'multiplayer'],
  },
  {
    titleMatch: 'Call of Duty: Black Ops 6',
    aliases: ['COD BO6', 'Call of Duty', 'BO6', 'COD', 'Black Ops 6', 'Black Ops', 'Call of Duty BO6'],
    keywords: ['fps', 'first person shooter', 'treyarch', 'activision', 'zombies', 'warzone', 'multiplayer', 'campaign'],
  },
  {
    titleMatch: 'Xbox Series X Console',
    aliases: ['XSX', 'Xbox X', 'Series X', 'Xbox Series X', 'Microsoft Xbox'],
    keywords: ['microsoft', 'xbox', 'next gen', '4k 120fps', 'game pass', 'velocity architecture', 'console'],
  },
];

const POPULAR_SEARCH_TERMS = [
  { term: 'playstation 5', searchCount: 184, isPinned: true },
  { term: 'gta 5', searchCount: 165, isPinned: true },
  { term: 'rdr', searchCount: 142, isPinned: true },
  { term: 'ps5', searchCount: 230, isPinned: true },
  { term: 'cod bo6', searchCount: 128, isPinned: true },
  { term: 'dualsense', searchCount: 95, isPinned: true },
  { term: 'spider-man 2', searchCount: 88, isPinned: false },
  { term: 'black myth wukong', searchCount: 110, isPinned: true },
  { term: 'fc 26', searchCount: 104, isPinned: false },
  { term: 'nintendo switch', searchCount: 76, isPinned: false },
  { term: 'xbox series x', searchCount: 65, isPinned: false },
];

async function seedKeywordsAndAliases() {
  try {
    console.log('--- Seeding Keywords, Aliases & Search Terms ---');
    await sequelize.authenticate();
    await sequelize.sync();

    // 1. Enrich existing products with aliases and keywords
    for (const item of CATALOG_ENRICHMENTS) {
      const product = await Product.findOne({
        where: {
          title: { [sequelize.Op.iLike]: `%${item.titleMatch}%` }
        }
      });

      if (product) {
        await product.update({
          aliases: item.aliases,
          keywords: item.keywords
        });
        console.log(`✓ Updated aliases & keywords for: "${product.title}"`);
      } else {
        // Create product if it's one of the canonical requested games/consoles like GTA V, RDR, COD BO6, XSX
        let category;
        if (item.titleMatch.includes('Console') || item.titleMatch.includes('Xbox')) {
          category = await Category.findOne({ where: { slug: 'consoles' } });
        } else {
          category = await Category.findOne({ where: { slug: 'games' } });
        }

        if (category && (item.titleMatch.includes('Red Dead') || item.titleMatch.includes('Grand Theft') || item.titleMatch.includes('Call of Duty') || item.titleMatch.includes('Xbox'))) {
          const newProd = await Product.create({
            title: item.titleMatch,
            description: `Experience the critically acclaimed ${item.titleMatch} with enhanced performance, rich graphics, and immersive gameplay.`,
            condition: 'New',
            modelNumber: `QT-${item.aliases[0].replace(/\s+/g, '-').toUpperCase()}-2025`,
            categoryId: category.id,
            tags: [item.aliases[0], category.name, 'Action', 'BestSeller'],
            aliases: item.aliases,
            keywords: item.keywords,
            attributes: { platform: item.titleMatch.includes('Xbox') ? 'Xbox Series X' : 'PS5' },
            isFeatured: true,
            isBestSeller: true,
            status: 'Published'
          });

          await ProductVariation.create({
            productId: newProd.id,
            sku: `SKU-${item.aliases[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-01`,
            color: 'Standard',
            edition: 'Standard Edition',
            platform: item.titleMatch.includes('Xbox') ? 'Xbox Series X' : 'PS5',
            price: item.titleMatch.includes('Console') || item.titleMatch.includes('Xbox') ? 499.99 : 69.99,
            costPrice: 40.00,
            stockQuantity: 15,
            lowStockThreshold: 3,
            isActive: true
          });

          console.log(`+ Created canonical demo product: "${newProd.title}" with aliases: ${item.aliases.join(', ')}`);
        }
      }
    }

    // 2. Seed Search Terms
    for (const termObj of POPULAR_SEARCH_TERMS) {
      const [record, created] = await SearchTerm.findOrCreate({
        where: { term: termObj.term },
        defaults: {
          term: termObj.term,
          searchCount: termObj.searchCount,
          resultsCount: 5,
          isPinned: termObj.isPinned,
          lastSearchedAt: new Date()
        }
      });

      if (!created) {
        await record.update({
          searchCount: termObj.searchCount,
          isPinned: termObj.isPinned
        });
      }
    }

    console.log('✓ Popular Search Terms seeded successfully');
    console.log('--- Completed Seeding ---');
  } catch (error) {
    console.error('Error seeding keywords:', error);
  }
}

seedKeywordsAndAliases();
