// One-time migration: copies every table from the old PostgreSQL database into Redis.
//
//   1. Keep the old DATABASE_URL (or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD) in .env
//   2. Set REDIS_URL in .env (Vercel / Upstash connection string)
//   3. npm run migrate:pg-to-redis            (aborts if Redis already contains data)
//      npm run migrate:pg-to-redis -- --force (overwrites rows with the same id)
//
// The script only READS from PostgreSQL; nothing is changed or deleted there.

require('dotenv').config();
const { Client } = require('pg');
const models = require('../models');
const store = require('../orm/store');
const { serializeValue, uniqueValue } = require('../orm/model');

const FORCE = process.argv.includes('--force');
const CHUNK = 100;

const snake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

// Sequelize's default table names for the models (underscored + pluralised)
const TABLE_FOR_MODEL = {
  User: ['users'],
  VendorProfile: ['vendor_profiles'],
  Category: ['categories'],
  Product: ['products'],
  ProductVariation: ['product_variations'],
  InventoryMovement: ['inventory_movements'],
  Media: ['media', 'medias'],
  Order: ['orders'],
  OrderItem: ['order_items'],
  SupplierLedger: ['supplier_ledgers'],
  Page: ['pages'],
  WebsiteSetting: ['website_settings'],
  Discount: ['discounts'],
  RepairRequest: ['repair_requests'],
  SellRequest: ['sell_requests'],
  ChatConversation: ['chat_conversations'],
  SearchTerm: ['search_terms'],
  Invoice: ['invoices'],
  VendorStock: ['vendor_stocks'],
};

const connectPg = () => {
  const url = process.env.DATABASE_URL;
  const isLocal = !url || /localhost|127\.0\.0\.1/.test(url);
  const ssl = process.env.DB_SSL === 'false' || isLocal ? false : { rejectUnauthorized: false };
  if (url) return new Client({ connectionString: url, ssl });
  return new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'qt_ecommerce',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl,
  });
};

const toRaw = (Model, pgRow) => {
  const raw = {};
  for (const [name, attr] of Object.entries(Model.rawAttributes)) {
    let value = pgRow[snake(name)];
    if (value === undefined) value = pgRow[name];
    raw[name] = serializeValue(attr, value === undefined ? null : value);
  }
  return raw;
};

const main = async () => {
  const pg = connectPg();
  await pg.connect();
  console.log('Connected to PostgreSQL (read-only).');
  await store.ping();
  console.log('Connected to Redis.');

  const existing = await pg.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  const tables = new Set(existing.rows.map((r) => r.table_name));

  if (!FORCE) {
    const userCount = await models.User.count();
    if (userCount > 0) {
      throw new Error('Redis already contains users. Re-run with --force to overwrite, or use an empty Redis database.');
    }
  }

  let total = 0;
  for (const Model of Object.values(models.sequelize.models)) {
    const candidates = TABLE_FOR_MODEL[Model.name] || [snake(Model.name) + 's'];
    const pgTable = candidates.find((t) => tables.has(t));
    if (!pgTable) {
      console.warn(`- ${Model.name}: no PostgreSQL table found (${candidates.join(' / ')}), skipped`);
      continue;
    }
    const { rows } = await pg.query(`SELECT * FROM "${pgTable}"`);
    const ops = [];
    for (const pgRow of rows) {
      const raw = toRaw(Model, pgRow);
      const id = String(raw[Model.primaryKey]);
      const us = [];
      for (const def of Model.uniqueDefs) {
        const v = uniqueValue(def, raw);
        if (v !== null) us.push([def.name, v]);
      }
      // ev = -1: write regardless of the current version (re-runnable with --force)
      ops.push({ t: Model.tableName, id, ev: -1, mode: 'set', json: JSON.stringify(raw), us, ud: [] });
    }
    for (let i = 0; i < ops.length; i += CHUNK) {
      await store.commitOps(ops.slice(i, i + CHUNK));
    }
    total += ops.length;
    console.log(`- ${Model.name}: ${ops.length} rows copied from "${pgTable}"`);
  }

  await pg.end();
  store.clearCache();
  console.log(`\nDone. ${total} rows are now in Redis.`);
  process.exit(0);
};

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
