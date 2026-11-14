// Sequelize-compatible data types & operators used by the models/controllers.
// The project now stores all data in Redis (see ./store.js); this module only
// describes columns so the rest of the code can stay unchanged.

const makeType = (kind, build) => {
  const fn = (...args) => (build ? build(...args) : { kind });
  fn.kind = kind;
  fn.__isType = true;
  return fn;
};

const DataTypes = {
  STRING: makeType('STRING', (length) => ({ kind: 'STRING', length })),
  TEXT: makeType('TEXT'),
  UUID: makeType('UUID'),
  BOOLEAN: makeType('BOOLEAN'),
  INTEGER: makeType('INTEGER'),
  BIGINT: makeType('BIGINT'),
  FLOAT: makeType('FLOAT'),
  DECIMAL: makeType('DECIMAL', (precision = 10, scale = 0) => ({ kind: 'DECIMAL', precision, scale })),
  DATE: makeType('DATE'),
  DATEONLY: makeType('DATEONLY'),
  JSON: makeType('JSON'),
  JSONB: makeType('JSON'),
  ENUM: makeType('ENUM', (...values) => ({ kind: 'ENUM', values: values.flat() })),
  UUIDV4: { __default: 'uuidv4' },
  NOW: { __default: 'now' },
};

const resolveType = (type) => {
  if (typeof type === 'function' && type.__isType) return type();
  if (type && typeof type === 'object' && type.kind) return type;
  return { kind: 'STRING' };
};

const Op = {
  and: Symbol('and'),
  or: Symbol('or'),
  eq: Symbol('eq'),
  ne: Symbol('ne'),
  gt: Symbol('gt'),
  gte: Symbol('gte'),
  lt: Symbol('lt'),
  lte: Symbol('lte'),
  in: Symbol('in'),
  notIn: Symbol('notIn'),
  like: Symbol('like'),
  notLike: Symbol('notLike'),
  iLike: Symbol('iLike'),
  notILike: Symbol('notILike'),
  between: Symbol('between'),
  notBetween: Symbol('notBetween'),
  not: Symbol('not'),
  is: Symbol('is'),
};

module.exports = { DataTypes, Op, resolveType };
