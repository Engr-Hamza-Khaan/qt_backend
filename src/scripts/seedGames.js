require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  sequelize,
  Category,
  Product,
  ProductVariation,
  Media,
  InventoryMovement,
} = require('../models');

const GAMES_DIR = path.resolve(__dirname, '../../../qt_frontend/public/games');

const GAME_CATALOG = [
  {
    file: 'Astrobot.png',
    title: 'Astro Bot',
    description:
      'Embark on a galactic-sized dual-speed adventure with Astro and his over 300 new species of bots. Rebuilt from the ground up for PS5 with innovative use of the DualSense wireless controller.',
    modelNumber: 'PS5-ASTRO-BOT-2024',
    tags: ['PS5', 'Platformer', 'Adventure', 'Sony', 'Team Asobi'],
    specifications: {
      developer: 'Team Asobi',
      publisher: 'Sony Interactive Entertainment',
      genre: 'Platform / Adventure',
      releaseDate: '2024-09-06',
      rating: 'E (Everyone)',
      players: '1 Player',
    },
    attributes: { platform: 'PS5', genre: 'Platformer', publisher: 'Sony' },
    edition: 'Standard Edition',
    price: 59.99,
    costPrice: 38.0,
    stockQuantity: 18,
  },
  {
    file: 'Battlefield 6.png',
    title: 'Battlefield 6',
    description:
      'Experience all-out warfare at an unprecedented scale. Battlefield 6 delivers massive maps, dynamic destruction, and squad-based combat with next-gen visuals powered by the Frostbite engine on PS5.',
    modelNumber: 'PS5-BF6-STD-2025',
    tags: ['PS5', 'FPS', 'Multiplayer', 'EA', 'Battlefield'],
    specifications: {
      developer: 'Battlefield Studios',
      publisher: 'Electronic Arts',
      genre: 'First-Person Shooter',
      releaseDate: '2025-10-10',
      rating: 'M (Mature 17+)',
      players: '1-128 Players Online',
    },
    attributes: { platform: 'PS5', genre: 'FPS', publisher: 'EA' },
    edition: 'Standard Edition',
    price: 69.99,
    costPrice: 45.0,
    stockQuantity: 25,
  },
  {
    file: 'BlackMyth.png',
    title: 'Black Myth: Wukong',
    description:
      'Black Myth: Wukong is an action RPG rooted in Chinese mythology. Play as the Destined One and embark on a journey to uncover the truth behind a glorious legend from Journey to the West.',
    modelNumber: 'PS5-BMW-STD-2024',
    tags: ['PS5', 'Action RPG', 'Souls-like', 'Game Science', 'Wukong'],
    specifications: {
      developer: 'Game Science',
      publisher: 'Game Science',
      genre: 'Action RPG',
      releaseDate: '2024-08-20',
      rating: 'M (Mature 17+)',
      players: '1 Player',
    },
    attributes: { platform: 'PS5', genre: 'Action RPG', publisher: 'Game Science' },
    edition: 'Standard Edition',
    price: 59.99,
    costPrice: 40.0,
    stockQuantity: 14,
  },
  {
    file: 'FC 26.png',
    title: 'EA Sports FC 26',
    description:
      'EA SPORTS FC 26 brings the world\'s game to life with HyperMotion V technology, enhanced Career Mode, and the most authentic football experience on PlayStation 5.',
    modelNumber: 'PS5-FC26-STD-2025',
    tags: ['PS5', 'Sports', 'Football', 'EA Sports', 'FC 26'],
    specifications: {
      developer: 'EA Vancouver / EA Romania',
      publisher: 'Electronic Arts',
      genre: 'Sports / Football',
      releaseDate: '2025-09-26',
      rating: 'E (Everyone)',
      players: '1-22 Players',
    },
    attributes: { platform: 'PS5', genre: 'Sports', publisher: 'EA Sports' },
    edition: 'Standard Edition',
    price: 69.99,
    costPrice: 46.0,
    stockQuantity: 30,
  },
  {
    file: 'GOY.png',
    title: 'Ghost of Yōtei',
    description:
      'Set in 1600s feudal Japan, Ghost of Yōtei follows a new warrior on a quest for vengeance across the snow-covered landscapes of Mount Yōtei. A spiritual successor to Ghost of Tsushima with stunning open-world combat.',
    modelNumber: 'PS5-GOY-STD-2025',
    tags: ['PS5', 'Action', 'Open World', 'Sony', 'Samurai'],
    specifications: {
      developer: 'Sucker Punch Productions',
      publisher: 'Sony Interactive Entertainment',
      genre: 'Action / Open World',
      releaseDate: '2025-10-02',
      rating: 'M (Mature 17+)',
      players: '1 Player',
    },
    attributes: { platform: 'PS5', genre: 'Action', publisher: 'Sony' },
    edition: 'Standard Edition',
    price: 69.99,
    costPrice: 44.0,
    stockQuantity: 20,
  },
  {
    file: 'Spideman.png',
    title: 'Marvel\'s Spider-Man 2',
    description:
      'Swing through a larger Marvel\'s New York as both Peter Parker and Miles Morales. Face off against Venom and Kraven the Hunter in this blockbuster PS5 exclusive with ray-traced visuals and near-instant load times.',
    modelNumber: 'PS5-SM2-STD-2023',
    tags: ['PS5', 'Action', 'Superhero', 'Insomniac', 'Marvel'],
    specifications: {
      developer: 'Insomniac Games',
      publisher: 'Sony Interactive Entertainment',
      genre: 'Action / Adventure',
      releaseDate: '2023-10-20',
      rating: 'T (Teen)',
      players: '1 Player',
    },
    attributes: { platform: 'PS5', genre: 'Action', publisher: 'Sony' },
    edition: 'Standard Edition',
    price: 49.99,
    costPrice: 32.0,
    stockQuantity: 22,
    isBestSeller: true,
  },
  {
    file: 'The Last of Us.png',
    title: 'The Last of Us Part II Remastered',
    description:
      'Experience Ellie and Abby\'s emotional journey remastered for PS5 with enhanced visuals, DualSense haptic feedback, adaptive triggers, and the No Return roguelike survival mode included.',
    modelNumber: 'PS5-TLOU2-REM-2024',
    tags: ['PS5', 'Action', 'Survival', 'Naughty Dog', 'Story-Driven'],
    specifications: {
      developer: 'Naughty Dog',
      publisher: 'Sony Interactive Entertainment',
      genre: 'Action / Survival',
      releaseDate: '2024-01-19',
      rating: 'M (Mature 17+)',
      players: '1 Player',
    },
    attributes: { platform: 'PS5', genre: 'Action', publisher: 'Sony' },
    edition: 'Remastered Edition',
    price: 49.99,
    costPrice: 30.0,
    stockQuantity: 16,
    isBestSeller: true,
  },
];

function imageToBase64DataUri(filePath) {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mime};base64,${buffer.toString('base64')}`;
}

function buildSku(modelNumber) {
  return modelNumber.replace(/[^A-Z0-9]/gi, '-').toUpperCase();
}

async function seedGames() {
  try {
    console.log('--- Seeding Featured Games ---');

    await sequelize.authenticate();
    await sequelize.query(`
      ALTER TABLE "media" ALTER COLUMN "url" TYPE TEXT;
    `).catch(() => {});

    let gamesCategory = await Category.findOne({ where: { slug: 'games' } });
    if (!gamesCategory) {
      gamesCategory = await Category.create({
        name: 'Games',
        slug: 'games',
        platform: 'Software',
        description: 'Physical & digital game titles',
      });
      console.log('-> Created Games category');
    }

    let created = 0;
    let skipped = 0;

    for (const game of GAME_CATALOG) {
      const existing = await Product.findOne({ where: { modelNumber: game.modelNumber } });
      if (existing) {
        console.log(`  Skipping "${game.title}" — already exists`);
        skipped++;
        continue;
      }

      const imagePath = path.join(GAMES_DIR, game.file);
      if (!fs.existsSync(imagePath)) {
        console.warn(`  Warning: Image not found for "${game.title}": ${imagePath}`);
        continue;
      }

      const base64Url = imageToBase64DataUri(imagePath);

      const product = await Product.create({
        title: game.title,
        description: game.description,
        specifications: game.specifications,
        condition: 'New',
        modelNumber: game.modelNumber,
        categoryId: gamesCategory.id,
        tags: game.tags,
        attributes: game.attributes,
        dimensions: { length: 17.2, width: 13.5, height: 1.5, unit: 'cm' },
        weight: 0.08,
        isFeatured: true,
        isBestSeller: game.isBestSeller || false,
        isFlashSale: false,
        status: 'Published',
      });

      const variation = await ProductVariation.create({
        productId: product.id,
        sku: buildSku(game.modelNumber),
        color: 'Standard Case',
        edition: game.edition,
        platform: 'PS5',
        price: game.price,
        costPrice: game.costPrice,
        stockQuantity: game.stockQuantity,
        lowStockThreshold: 5,
      });

      await Media.create({
        productId: product.id,
        url: base64Url,
        type: 'Image',
        isFeatured: true,
        orderIndex: 0,
      });

      await InventoryMovement.create({
        variationId: variation.id,
        quantityChanged: game.stockQuantity,
        previousStock: 0,
        newStock: game.stockQuantity,
        type: 'Restock',
        notes: `Initial stock for ${game.title}`,
      });

      console.log(`  + Created "${game.title}" (${(base64Url.length / 1024).toFixed(0)} KB base64 image)`);
      created++;
    }

    console.log(`--- Done: ${created} games created, ${skipped} skipped ---`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed games:', error);
    process.exit(1);
  }
}

seedGames();
