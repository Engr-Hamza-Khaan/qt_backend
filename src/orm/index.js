// Drop-in replacement for the parts of Sequelize this project uses, backed by Redis.
const { DataTypes, Op } = require('./datatypes');
const { define, Transaction, registry } = require('./model');
const store = require('./store');

const expr = (t, props) => ({ __t: t, ...props });

class Sequelize {
  constructor() {
    this.models = {};
    this.Op = Op;
    this.DataTypes = DataTypes;
  }

  define(name, attributes, options) {
    const Model = define(name, attributes, options);
    this.models[name] = Model;
    return Model;
  }

  // sequelize.transaction() -> Transaction, or sequelize.transaction(async (t) => {...})
  async transaction(callback) {
    const tx = new Transaction();
    if (typeof callback !== 'function') return tx;
    try {
      const result = await callback(tx);
      await tx.commit();
      return result;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  // expression builders (evaluated by the Redis query engine)
  col(name) {
    return expr('col', { name });
  }

  cast(val, type) {
    return expr('cast', { val, type });
  }

  fn(name, ...args) {
    return expr('fn', { name, args });
  }

  literal(sql) {
    return expr('literal', { sql });
  }

  where(left, cond) {
    return expr('where', { left, cond });
  }

  // Raw SQL does not exist for Redis; old maintenance statements (e.g. ALTER TABLE) are no-ops.
  async query() {
    return [[], 0];
  }

  async authenticate() {
    await store.ping();
  }

  // Redis is schemaless: nothing to create or alter. Kept so existing startup code keeps working.
  async sync() {
    await store.ping();
    return this;
  }

  async close() {
    const r = store.getRedis();
    if (r && r.quit) await r.quit();
  }

  getQueryInterface() {
    throw new Error('Query interface is not available: data is stored in Redis');
  }
}

Sequelize.Op = Op;
Sequelize.DataTypes = DataTypes;

module.exports = { Sequelize, DataTypes, Op, store, registry };
