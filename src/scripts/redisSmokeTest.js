// Quick self-check of the Redis ORM layer using an in-memory Redis mock (no server needed).
//   npm run test:redis
process.env.REDIS_MOCK = '1';
process.env.REDIS_CACHE_TTL_MS = '0';

const assert = require('assert');
const { sequelize, User, Product, ProductVariation, Category } = require('../models');
const { Op } = require('../orm');

(async () => {
  const u = await User.create({ name: 'A', email: 'a@x.com', password: 'secret', role: 'Customer' });
  assert(u.password.startsWith('$2'), 'password should be hashed by the beforeSave hook');

  await assert.rejects(() => User.create({ name: 'B', email: 'a@x.com', password: 'x' }), (e) => e.name === 'SequelizeUniqueConstraintError');
  await assert.rejects(() => User.create({ name: 'B', email: 'bad', password: 'x' }), (e) => e.name === 'SequelizeValidationError');
  await assert.rejects(() => User.create({ email: 'c@x.com', password: 'x' }), (e) => e.name === 'SequelizeValidationError');

  const cat = await Category.create({ name: 'Consoles', slug: 'consoles' });
  const p = await Product.create({ title: 'PS5', categoryId: cat.id, aliases: ['PS5'], attributes: { platform: 'PS5' } });
  const v = await ProductVariation.create({ productId: p.id, sku: 'S1', price: 499.5, stockQuantity: 5, costPrice: 400 });
  assert.strictEqual(v.price, '499.50', 'DECIMAL values are fixed-scale strings like Postgres');

  const found = await Product.findAll({
    where: { [Op.or]: [{ title: { [Op.iLike]: '%ps%' } }], 'attributes.platform': 'PS5' },
    include: [{ model: ProductVariation, as: 'variations' }, { model: Category, as: 'category' }],
  });
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].variations.length, 1);
  assert.strictEqual(found[0].category.slug, 'consoles');

  // transaction isolation + optimistic locking
  const t = await sequelize.transaction();
  const inTx = await ProductVariation.findByPk(v.id, { transaction: t });
  inTx.stockQuantity -= 2;
  await inTx.save({ transaction: t });
  assert.strictEqual((await ProductVariation.findByPk(v.id)).stockQuantity, 5, 'uncommitted change must be invisible');
  await t.commit();
  assert.strictEqual((await ProductVariation.findByPk(v.id)).stockQuantity, 3);

  const t1 = await sequelize.transaction();
  const t2 = await sequelize.transaction();
  const a1 = await ProductVariation.findByPk(v.id, { transaction: t1 });
  const a2 = await ProductVariation.findByPk(v.id, { transaction: t2 });
  a1.stockQuantity -= 1;
  a2.stockQuantity -= 1;
  await a1.save({ transaction: t1 });
  await a2.save({ transaction: t2 });
  await t1.commit();
  await assert.rejects(() => t2.commit(), (e) => e.name === 'SequelizeOptimisticLockError');
  assert.strictEqual((await ProductVariation.findByPk(v.id)).stockQuantity, 2, 'lost update must be prevented');

  await ProductVariation.update({ price: 10 }, { where: { productId: p.id } });
  assert.strictEqual((await ProductVariation.findByPk(v.id)).price, '10.00');

  await p.destroy();
  assert.strictEqual(await ProductVariation.count(), 0, 'variations are deleted with their product (CASCADE)');

  console.log('Redis ORM smoke test passed.');
  process.exit(0);
})().catch((err) => {
  console.error('Redis ORM smoke test FAILED:', err);
  process.exit(1);
});
