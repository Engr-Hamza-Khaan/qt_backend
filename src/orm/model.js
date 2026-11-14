// Sequelize-compatible Model layer backed by Redis (see ./store.js).
// Supports the subset of the Sequelize API this project uses: define / associations,
// findAll / findOne / findByPk / findAndCountAll / count / sum / create / bulkCreate /
// update / destroy / findOrCreate, includes, where operators, ordering, transactions,
// validations, hooks and instance methods (save, update, destroy, reload, toJSON).

const { randomUUID } = require('crypto');
const { Op, resolveType } = require('./datatypes');
const store = require('./store');

const ORM_NAME = 'RedisORM';

// ───────────────────────────── helpers ─────────────────────────────

const clone = (v) => (v === undefined || v === null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v)));

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !v.__t;

const snakeToCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const ormError = (name, message, extra = {}) => store.makeError(name, message, extra);

const validationError = (errors) =>
  ormError('SequelizeValidationError', `Validation error: ${errors.map((e) => e.message).join(', ')}`, { errors });

// ──────────────────────── serialize / deserialize ────────────────────────

const serializeValue = (attr, value) => {
  if (value === undefined || value === null) return null;
  const { kind, scale } = attr.typeInfo;
  switch (kind) {
    case 'DATE': {
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) throw validationError([{ message: `${attr.fieldName} is not a valid date`, path: attr.fieldName, type: 'Validation error' }]);
      return d.toISOString();
    }
    case 'DATEONLY': {
      const d = value instanceof Date ? value : new Date(value);
      return Number.isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 10);
    }
    case 'DECIMAL':
    case 'FLOAT': {
      const n = Number(value);
      if (Number.isNaN(n)) throw validationError([{ message: `${attr.fieldName} must be a number`, path: attr.fieldName, type: 'Validation error' }]);
      return kind === 'DECIMAL' ? Number(n.toFixed(scale ?? 2)) : n;
    }
    case 'INTEGER':
    case 'BIGINT': {
      const n = typeof value === 'number' ? value : parseInt(value, 10);
      if (Number.isNaN(n)) throw validationError([{ message: `${attr.fieldName} must be an integer`, path: attr.fieldName, type: 'Validation error' }]);
      return Math.trunc(n);
    }
    case 'BOOLEAN':
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 1 || value === '1') return true;
      if (value === 'false' || value === 0 || value === '0') return false;
      return Boolean(value);
    case 'JSON':
      return clone(value);
    case 'ENUM':
    case 'STRING':
    case 'TEXT':
    case 'UUID':
    default:
      return typeof value === 'string' ? value : String(value);
  }
};

const deserializeValue = (attr, raw) => {
  if (raw === undefined || raw === null) return null;
  const { kind, scale } = attr.typeInfo;
  switch (kind) {
    case 'DATE':
      return new Date(raw);
    case 'DECIMAL':
      return Number(raw).toFixed(scale ?? 2); // pg returns NUMERIC as a fixed-scale string
    case 'JSON':
      return clone(raw);
    default:
      return raw;
  }
};

const makeDefault = (attr) => {
  const d = attr.defaultValue;
  if (d === undefined) return undefined;
  if (d && d.__default === 'uuidv4') return randomUUID();
  if (d && d.__default === 'now') return new Date();
  if (typeof d === 'function') return d();
  return clone(d);
};

// ──────────────────────── transactions / unit of work ────────────────────────

class Transaction {
  constructor() {
    this.finished = false;
    this.overlay = new Map(); // table -> Map<id, { raw|null, ev, oldRaw, uniq }>
    this.seen = new Map(); // `${table}:${id}` -> version first read in this transaction
  }

  entry(table, id) {
    return this.overlay.get(table)?.get(id);
  }

  // Row view = committed rows overlaid with this transaction's staged writes.
  async view(table) {
    const base = await store.loadTable(table);
    const staged = this.overlay.get(table);
    if (!staged || staged.size === 0) return { rows: base.rows, vers: base.vers };
    const rows = new Map(base.rows);
    const vers = new Map(base.vers);
    for (const [id, e] of staged) {
      if (e.raw === null) {
        rows.delete(id);
        vers.delete(id);
      } else {
        rows.set(id, e.raw);
        if (!vers.has(id)) vers.set(id, 0);
      }
    }
    return { rows, vers };
  }

  markSeen(table, id, version) {
    const key = `${table}:${id}`;
    if (!this.seen.has(key)) this.seen.set(key, version);
  }

  // Stage a write. raw === null means delete.
  stage(Model, id, raw, base) {
    const table = Model.tableName;
    if (!this.overlay.has(table)) this.overlay.set(table, new Map());
    const staged = this.overlay.get(table);
    const prev = staged.get(id);
    if (prev) {
      // keep the original expectation and original stored row (for unique-index cleanup)
      if (raw === null && prev.ev === 0) {
        staged.delete(id); // created and deleted inside the same transaction
        return;
      }
      prev.raw = raw;
      return;
    }
    const key = `${table}:${id}`;
    const ev = base ? (this.seen.has(key) ? this.seen.get(key) : base.v) : 0;
    staged.set(id, { raw, ev, oldRaw: base ? base.raw : null });
  }

  buildOps() {
    const ops = [];
    for (const [table, staged] of this.overlay) {
      const Model = registry.get(table);
      for (const [id, e] of staged) {
        const us = [];
        const ud = [];
        for (const def of Model.uniqueDefs) {
          const nv = e.raw ? uniqueValue(def, e.raw) : null;
          const ov = e.oldRaw ? uniqueValue(def, e.oldRaw) : null;
          if (nv !== null) us.push([def.name, nv]);
          if (ov !== null && ov !== nv) ud.push([def.name, ov]);
        }
        ops.push({
          t: table,
          id,
          ev: e.ev,
          mode: e.raw === null ? 'del' : 'set',
          json: e.raw === null ? '' : JSON.stringify(e.raw),
          us,
          ud,
        });
      }
    }
    return ops;
  }

  async commit() {
    if (this.finished) return;
    this.finished = true;
    await store.commitOps(this.buildOps());
    this.overlay.clear();
  }

  async rollback() {
    this.finished = true;
    this.overlay.clear();
  }
}

const uniqueValue = (def, raw) => {
  const parts = def.fields.map((f) => raw[f]);
  if (parts.some((p) => p === null || p === undefined)) return null;
  return parts.map(String).join('\u0001');
};

// Runs `fn(tx)` in the caller's transaction or in a short auto-committed one (with retry on conflicts).
const withTx = async (opts, fn) => {
  if (opts && opts.transaction) return fn(opts.transaction);
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const tx = new Transaction();
    try {
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (err) {
      if (err.name === 'SequelizeOptimisticLockError' && attempt < 6) {
        attempt += 1;
        continue;
      }
      throw err;
    }
  }
};

const getView = async (Model, opts) => {
  const tx = opts && opts.transaction;
  if (tx) return tx.view(Model.tableName);
  const t = await store.loadTable(Model.tableName);
  return { rows: t.rows, vers: t.vers };
};

// ──────────────────────── where evaluation ────────────────────────

const colValue = (Model, raw, name) => {
  const last = String(name).split('.').pop();
  if (last in raw) return raw[last];
  const camel = snakeToCamel(last);
  return raw[camel];
};

const evalExpr = (Model, raw, expr) => {
  if (expr && expr.__t === 'col') return colValue(Model, raw, expr.name);
  if (expr && expr.__t === 'cast') {
    const inner = evalExpr(Model, raw, expr.val);
    if (inner === null || inner === undefined) return null;
    return typeof inner === 'object' ? JSON.stringify(inner) : String(inner);
  }
  if (expr && expr.__t === 'fn' && /^(lower)$/i.test(expr.name)) {
    const v = evalExpr(Model, raw, expr.args[0]);
    return v === null || v === undefined ? null : String(v).toLowerCase();
  }
  if (expr && expr.__t === 'literal') throw ormError('SequelizeDatabaseError', `sequelize.literal() is not supported by the Redis layer: ${expr.sql}`);
  if (expr && expr.__t === 'fn') throw ormError('SequelizeDatabaseError', `sequelize.fn('${expr.name}') is not supported by the Redis layer`);
  return expr;
};

const likeToRegex = (pattern, insensitive) => {
  const esc = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${esc}$`, insensitive ? 'is' : 's');
};

const cmpKey = (v) => {
  if (v instanceof Date) return v.getTime();
  return v;
};

// Compare helper that copes with Date / numeric string / number mixes.
const normalizePair = (a, b, kind) => {
  if (kind === 'DATE' || a instanceof Date || b instanceof Date) {
    const ta = a === null || a === undefined ? a : new Date(a).getTime();
    const tb = b === null || b === undefined ? b : new Date(b).getTime();
    return [ta, tb];
  }
  if (kind === 'DECIMAL' || kind === 'INTEGER' || kind === 'FLOAT' || kind === 'BIGINT') {
    return [a === null || a === undefined ? a : Number(a), b === null || b === undefined ? b : Number(b)];
  }
  return [a, b];
};

const applyOperator = (opSym, left, right, kind, Model, raw) => {
  const rhs = right && right.__t === 'col' ? colValue(Model, raw, right.name) : right;
  const eq = (a, b) => {
    const [x, y] = normalizePair(a, b, kind);
    return x === y;
  };
  switch (opSym) {
    case Op.eq:
      return rhs === null ? left === null || left === undefined : eq(left, rhs);
    case Op.is:
      return rhs === null ? left === null || left === undefined : eq(left, rhs);
    case Op.ne:
      return rhs === null ? !(left === null || left === undefined) : !eq(left, rhs);
    case Op.not:
      if (rhs === null) return !(left === null || left === undefined);
      if (Array.isArray(rhs)) return !rhs.some((r) => eq(left, r));
      return !eq(left, rhs);
    case Op.gt:
    case Op.gte:
    case Op.lt:
    case Op.lte: {
      if (left === null || left === undefined || rhs === null || rhs === undefined) return false;
      const [x, y] = normalizePair(left, rhs, kind);
      if (opSym === Op.gt) return x > y;
      if (opSym === Op.gte) return x >= y;
      if (opSym === Op.lt) return x < y;
      return x <= y;
    }
    case Op.in:
      if (!Array.isArray(rhs)) throw ormError('SequelizeDatabaseError', 'Op.in with sequelize.literal() subqueries is not supported by the Redis layer');
      return rhs.some((r) => eq(left, r));
    case Op.notIn:
      return !rhs.some((r) => eq(left, r));
    case Op.like:
    case Op.iLike:
      if (left === null || left === undefined) return false;
      return likeToRegex(rhs, opSym === Op.iLike).test(typeof left === 'object' ? JSON.stringify(left) : String(left));
    case Op.notLike:
    case Op.notILike:
      if (left === null || left === undefined) return false;
      return !likeToRegex(rhs, opSym === Op.notILike).test(String(left));
    case Op.between:
    case Op.notBetween: {
      if (left === null || left === undefined) return false;
      const [x, lo] = normalizePair(left, rhs[0], kind);
      const [, hi] = normalizePair(left, rhs[1], kind);
      const inside = x >= lo && x <= hi;
      return opSym === Op.between ? inside : !inside;
    }
    default:
      throw ormError('SequelizeDatabaseError', `Unsupported operator ${String(opSym)}`);
  }
};

const getByPath = (obj, parts) => parts.reduce((acc, p) => (acc === null || acc === undefined ? undefined : acc[p]), obj);

const matchWhere = (Model, raw, where) => {
  if (where === null || where === undefined) return true;
  if (where.__t === 'where') {
    const left = evalExpr(Model, raw, where.left);
    const cond = where.cond;
    if (isPlainObject(cond) || Object.getOwnPropertySymbols(cond || {}).length) {
      return Object.getOwnPropertySymbols(cond).every((s) => applyOperator(s, left, cond[s], 'STRING', Model, raw));
    }
    return applyOperator(Op.eq, left, cond, 'STRING', Model, raw);
  }

  const syms = Object.getOwnPropertySymbols(where);
  for (const s of syms) {
    const v = where[s];
    if (s === Op.or) {
      const list = Array.isArray(v) ? v : Object.entries(v).map(([k, val]) => ({ [k]: val }));
      if (!list.some((item) => matchWhere(Model, raw, item))) return false;
    } else if (s === Op.and) {
      const list = Array.isArray(v) ? v : [v];
      if (!list.every((item) => matchWhere(Model, raw, item))) return false;
    } else if (s === Op.not) {
      if (matchWhere(Model, raw, v)) return false;
    }
  }

  for (const key of Object.keys(where)) {
    const cond = where[key];
    const parts = key.split('.');
    const attr = Model.rawAttributes[parts[0]];
    const kind = attr ? attr.typeInfo.kind : 'STRING';
    let left = raw[parts[0]];
    if (parts.length > 1) left = getByPath(left, parts.slice(1));

    if (cond !== null && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond) && cond.__t !== 'col') {
      const opSyms = Object.getOwnPropertySymbols(cond);
      if (opSyms.length) {
        if (!opSyms.every((s) => applyOperator(s, left, cond[s], parts.length > 1 ? 'STRING' : kind, Model, raw))) return false;
        continue;
      }
      // plain object compared against a JSON column
      if (JSON.stringify(left) !== JSON.stringify(cond)) return false;
      continue;
    }
    if (Array.isArray(cond)) {
      if (!applyOperator(Op.in, left, cond, kind, Model, raw)) return false;
      continue;
    }
    if (!applyOperator(Op.eq, left, cond, parts.length > 1 ? 'STRING' : kind, Model, raw)) return false;
  }
  return true;
};

// ──────────────────────── ordering ────────────────────────

const compareValues = (a, b) => {
  const an = a === null || a === undefined;
  const bn = b === null || b === undefined;
  if (an && bn) return 0;
  if (an) return 1; // NULLS LAST for ASC (Postgres default)
  if (bn) return -1;
  const x = cmpKey(a);
  const y = cmpKey(b);
  if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y);
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
};

const sortRows = (Model, items, order) => {
  const specs = [];
  const list = order || [['createdAt', 'ASC']];
  for (const o of list) {
    const parts = Array.isArray(o) ? o : [o, 'ASC'];
    const field = parts[0];
    const dir = String(parts[1] || 'ASC').toUpperCase() === 'DESC' ? -1 : 1;
    if (field && typeof field === 'object' && field.__t) {
      throw ormError('SequelizeDatabaseError', 'Ordering by sequelize.fn()/literal() is not supported by the Redis layer');
    }
    specs.push({ field: String(field), dir });
  }
  items.sort((p, q) => {
    for (const s of specs) {
      const attr = Model.rawAttributes[s.field];
      const av = attr && attr.typeInfo.kind === 'DECIMAL' ? Number(p.raw[s.field]) : p.raw[s.field];
      const bv = attr && attr.typeInfo.kind === 'DECIMAL' ? Number(q.raw[s.field]) : q.raw[s.field];
      let c = compareValues(av, bv);
      if (s.dir === -1) {
        // DESC puts NULLs first in Postgres, so invert the whole comparison
        c = compareValues(bv, av);
      }
      if (c !== 0) return c;
    }
    return 0;
  });
  return items;
};

// ──────────────────────── includes ────────────────────────

const normalizeIncludes = (Model, include) => {
  if (!include) return [];
  const list = Array.isArray(include) ? include : [include];
  return list
    .filter(Boolean)
    .map((inc) => {
      let spec = inc;
      if (typeof inc === 'function' || (inc && inc.tableName && !inc.model)) spec = { model: inc };
      const model = spec.model;
      let assoc = null;
      if (spec.as) assoc = Model.associations[spec.as];
      else assoc = Object.values(Model.associations).find((a) => a.target === model);
      if (!assoc) {
        throw ormError('SequelizeEagerLoadingError', `${model && model.name} is not associated to ${Model.name}${spec.as ? ` (as "${spec.as}")` : ''}`);
      }
      return { ...spec, assoc, model: assoc.target };
    });
};

const isRequired = (inc) => (inc.required !== undefined ? inc.required : Boolean(inc.where));

// Attaches associated rows to `items` ([{ raw, v, inc }]) and applies required filtering.
const loadIncludes = async (Model, items, includes, opts) => {
  let current = items;
  for (const inc of includes) {
    const { assoc } = inc;
    const Target = assoc.target;
    const view = await getView(Target, opts);
    const nested = normalizeIncludes(Target, inc.include);
    const targetRows = [];
    for (const [id, raw] of view.rows) targetRows.push({ id, raw, v: view.vers.get(id) || 1, inc: {} });

    // index target rows by the join key
    const byKey = new Map();
    const matchTarget = (t) => matchWhere(Target, t.raw, inc.where);
    if (assoc.type === 'belongsTo') {
      for (const t of targetRows) byKey.set(t.raw.id ?? t.id, t);
    } else {
      for (const t of targetRows) {
        const k = t.raw[assoc.foreignKey];
        if (k === null || k === undefined) continue;
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push(t);
      }
    }

    // resolve nested includes on the candidate target rows once
    let candidates = targetRows.filter(matchTarget);
    if (nested.length) {
      candidates = await loadIncludes(Target, candidates, nested, opts);
    }
    const allowed = new Set(candidates.map((c) => c.id));
    const candById = new Map(candidates.map((c) => [c.id, c]));

    const next = [];
    for (const it of current) {
      let found;
      if (assoc.type === 'belongsTo') {
        const k = it.raw[assoc.foreignKey];
        const t = k === null || k === undefined ? null : byKey.get(k);
        found = t && allowed.has(t.id) ? [t] : [];
      } else {
        const list = (byKey.get(it.raw.id) || []).filter((t) => allowed.has(t.id));
        found = list;
      }
      if (assoc.type === 'hasMany') {
        found = sortRows(Target, [...found], inc.order || [['createdAt', 'ASC']]);
        if (inc.limit) found = found.slice(0, inc.limit);
      }
      if (isRequired(inc) && found.length === 0) continue;
      // keep the nested instance data (already resolved in `candidates`)
      const resolved = found.map((f) => candById.get(f.id) || f);
      it.inc[inc.as || assoc.as] = { assoc, spec: inc, rows: resolved };
      next.push(it);
    }
    current = next;
  }
  return current;
};

const pickAttributes = (Model, attributes) => {
  const all = Object.keys(Model.rawAttributes);
  if (!attributes) return all;
  if (Array.isArray(attributes)) {
    const picked = attributes.map((a) => (Array.isArray(a) ? a[1] : a)).filter((a) => typeof a === 'string');
    return picked.length ? picked : all;
  }
  if (attributes.exclude || attributes.include) {
    const ex = new Set(attributes.exclude || []);
    return all.filter((a) => !ex.has(a));
  }
  return all;
};

const buildInstance = (Model, item, attributes, spec) => {
  const inst = Model._fromRaw(item.raw, item.v, pickAttributes(Model, attributes));
  for (const [alias, data] of Object.entries(item.inc || {})) {
    const { assoc, spec: iSpec, rows } = data;
    const Target = assoc.target;
    if (Array.isArray(iSpec.attributes) && iSpec.attributes.length === 0) continue;
    const built = rows.map((r) => buildInstance(Target, r, iSpec.attributes, iSpec));
    inst[alias] = assoc.type === 'hasMany' ? built : built[0] || null;
    inst._includes.push(alias);
  }
  // required includes that did not match are filtered earlier; optional ones default to null/[]
  return inst;
};

// ──────────────────────── Model ────────────────────────

const registry = new Map(); // tableName -> Model

class Model {
  constructor(values = {}, options = {}) {
    Object.defineProperty(this, 'dataValues', { value: {}, writable: true, enumerable: false });
    Object.defineProperty(this, '_changed', { value: new Set(), writable: true, enumerable: false });
    Object.defineProperty(this, '_includes', { value: [], writable: true, enumerable: false });
    Object.defineProperty(this, 'isNewRecord', { value: options.isNewRecord !== false, writable: true, enumerable: false });
    Object.defineProperty(this, '_v', { value: 0, writable: true, enumerable: false });
    const attrs = this.constructor.rawAttributes;
    for (const [name, attr] of Object.entries(attrs)) {
      if (values[name] !== undefined) {
        this.dataValues[name] = values[name];
        this._changed.add(name);
      } else {
        const d = makeDefault(attr);
        this.dataValues[name] = d === undefined ? null : d;
        if (d !== undefined) this._changed.add(name);
      }
    }
  }

  // ── static: lifecycle ──
  static build(values = {}, options = {}) {
    return new this(values, options);
  }

  static _fromRaw(raw, version, attributeList) {
    const inst = Object.create(this.prototype);
    Object.defineProperty(inst, 'dataValues', { value: {}, writable: true, enumerable: false });
    Object.defineProperty(inst, '_changed', { value: new Set(), writable: true, enumerable: false });
    Object.defineProperty(inst, '_includes', { value: [], writable: true, enumerable: false });
    Object.defineProperty(inst, 'isNewRecord', { value: false, writable: true, enumerable: false });
    Object.defineProperty(inst, '_v', { value: version || 1, writable: true, enumerable: false });
    for (const name of attributeList) {
      const attr = this.rawAttributes[name];
      if (!attr) continue;
      let r = raw[name];
      if (r === undefined) {
        const d = makeDefault(attr);
        r = d === undefined ? null : d instanceof Date ? d.toISOString() : d;
      }
      inst.dataValues[name] = deserializeValue(attr, r);
    }
    return inst;
  }

  static getTableName() {
    return this.tableName;
  }

  static async sync() {
    return this;
  }

  // ── static: associations ──
  static hasMany(Target, opts = {}) {
    this.associations[opts.as] = { type: 'hasMany', source: this, target: Target, foreignKey: opts.foreignKey, as: opts.as, onDelete: opts.onDelete };
    return this;
  }

  static hasOne(Target, opts = {}) {
    this.associations[opts.as] = { type: 'hasOne', source: this, target: Target, foreignKey: opts.foreignKey, as: opts.as, onDelete: opts.onDelete };
    return this;
  }

  static belongsTo(Target, opts = {}) {
    this.associations[opts.as] = { type: 'belongsTo', source: this, target: Target, foreignKey: opts.foreignKey, as: opts.as };
    return this;
  }

  // ── static: reading ──
  static async _matches(options = {}) {
    const view = await getView(this, options);
    const items = [];
    for (const [id, raw] of view.rows) {
      if (matchWhere(this, raw, options.where)) items.push({ id, raw, v: view.vers.get(id) || 1, inc: {} });
    }
    const includes = normalizeIncludes(this, options.include);
    const resolved = includes.length ? await loadIncludes(this, items, includes, options) : items;
    return { items: resolved, includes };
  }

  static async _select(options = {}) {
    const { items } = await this._matches(options);
    sortRows(this, items, options.order);
    let out = items;
    if (options.offset) out = out.slice(options.offset);
    if (options.limit !== undefined && options.limit !== null) out = out.slice(0, options.limit);
    if (options.transaction) out.forEach((it) => options.transaction.markSeen(this.tableName, it.id, it.v));
    return out.map((it) => buildInstance(this, it, options.attributes));
  }

  static async findAll(options = {}) {
    return this._select(options);
  }

  static async findOne(options = {}) {
    const rows = await this._select({ ...options, limit: 1 });
    return rows[0] || null;
  }

  static async findByPk(id, options = {}) {
    if (id === null || id === undefined) return null;
    const view = await getView(this, options);
    const key = String(id);
    if (!view.rows.has(key)) return null;
    const includes = options.include;
    if (!includes || (Array.isArray(includes) && includes.length === 0)) {
      const item = { id: key, raw: view.rows.get(key), v: view.vers.get(key) || 1, inc: {} };
      if (options.transaction) options.transaction.markSeen(this.tableName, key, item.v);
      return buildInstance(this, item, options.attributes);
    }
    return this.findOne({ ...options, where: { id: key } });
  }

  static async findAndCountAll(options = {}) {
    const { items } = await this._matches(options);
    const count = items.length;
    sortRows(this, items, options.order);
    let out = items;
    if (options.offset) out = out.slice(options.offset);
    if (options.limit !== undefined && options.limit !== null) out = out.slice(0, options.limit);
    if (options.transaction) out.forEach((it) => options.transaction.markSeen(this.tableName, it.id, it.v));
    return { count, rows: out.map((it) => buildInstance(this, it, options.attributes)) };
  }

  static async count(options = {}) {
    const { items } = await this._matches(options);
    return items.length;
  }

  static async sum(field, options = {}) {
    const { items } = await this._matches(options);
    const nums = items.map((it) => it.raw[field]).filter((v) => v !== null && v !== undefined);
    if (!nums.length) return null;
    return nums.reduce((acc, v) => acc + Number(v), 0);
  }

  static async max(field, options = {}) {
    const { items } = await this._matches(options);
    const vals = items.map((it) => it.raw[field]).filter((v) => v !== null && v !== undefined);
    if (!vals.length) return null;
    return vals.reduce((a, b) => (compareValues(a, b) >= 0 ? a : b));
  }

  static async min(field, options = {}) {
    const { items } = await this._matches(options);
    const vals = items.map((it) => it.raw[field]).filter((v) => v !== null && v !== undefined);
    if (!vals.length) return null;
    return vals.reduce((a, b) => (compareValues(a, b) <= 0 ? a : b));
  }

  // ── static: writing ──
  static async create(values = {}, options = {}) {
    const inst = this.build(values);
    return inst.save(options);
  }

  static async bulkCreate(list = [], options = {}) {
    const out = [];
    const run = async (opts) => {
      for (const v of list) out.push(await this.create(v, opts));
    };
    if (options.transaction) await run(options);
    else {
      const tx = new Transaction();
      await run({ ...options, transaction: tx });
      await tx.commit();
    }
    return out;
  }

  static async findOrCreate(options = {}) {
    const found = await this.findOne({ where: options.where, transaction: options.transaction });
    if (found) return [found, false];
    const base = {};
    for (const [k, v] of Object.entries(options.where || {})) {
      if (typeof v !== 'object' || v === null || v instanceof Date) base[k] = v;
    }
    const created = await this.create({ ...base, ...(options.defaults || {}) }, { transaction: options.transaction });
    return [created, true];
  }

  static async update(values, options = {}) {
    return withTx(options, async (tx) => {
      const txOpts = { ...options, transaction: tx };
      const view = await getView(this, txOpts);
      let count = 0;
      for (const [id, raw] of [...view.rows]) {
        if (!matchWhere(this, raw, options.where)) continue;
        const base = { raw, v: view.vers.get(id) || 1 };
        const inst = this._fromRaw(raw, base.v, Object.keys(this.rawAttributes));
        for (const [k, v] of Object.entries(values)) {
          if (v !== undefined && this.rawAttributes[k]) inst.set(k, v); // undefined values are ignored, like Sequelize
        }
        await inst._write(tx, base, options);
        count += 1;
      }
      return [count];
    });
  }

  static async destroy(options = {}) {
    return withTx(options, async (tx) => {
      const txOpts = { ...options, transaction: tx };
      const view = await getView(this, txOpts);
      let count = 0;
      for (const [id, raw] of [...view.rows]) {
        if (!options.truncate && !matchWhere(this, raw, options.where)) continue;
        await this._deleteRow(tx, id, raw, view.vers.get(id) || 1);
        count += 1;
      }
      return count;
    });
  }

  static async truncate(options = {}) {
    return this.destroy({ ...options, truncate: true });
  }

  static async _deleteRow(tx, id, raw, version) {
    // referential actions (mirrors the onDelete rules declared on associations)
    for (const Source of registry.values()) {
      for (const assoc of Object.values(Source.associations)) {
        if (assoc.type === 'belongsTo' || assoc.source !== this) continue;
        const Child = assoc.target;
        const childView = await tx.view(Child.tableName);
        const children = [...childView.rows].filter(([, c]) => c[assoc.foreignKey] === id);
        if (!children.length) continue;
        const action = String(assoc.onDelete || 'SET NULL').toUpperCase();
        if (action === 'CASCADE') {
          for (const [cid, craw] of children) await Child._deleteRow(tx, cid, craw, childView.vers.get(cid) || 1);
        } else if (action === 'RESTRICT' || action === 'NO ACTION') {
          throw ormError('SequelizeForeignKeyConstraintError', `Cannot delete ${this.name}: ${children.length} ${Child.name} record(s) still reference it`);
        } else {
          for (const [cid, craw] of children) {
            const updated = { ...craw, [assoc.foreignKey]: null, updatedAt: new Date().toISOString() };
            tx.stage(Child, cid, updated, { raw: craw, v: childView.vers.get(cid) || 1 });
          }
        }
      }
    }
    tx.stage(this, id, null, { raw, v: version });
  }

  // ── instance ──
  get(key, opts) {
    if (typeof key === 'string') return this.dataValues[key];
    return this.toJSON();
  }

  getDataValue(key) {
    return this.dataValues[key];
  }

  setDataValue(key, value) {
    this.dataValues[key] = value;
    this._changed.add(key);
  }

  set(key, value) {
    if (key && typeof key === 'object') {
      for (const [k, v] of Object.entries(key)) this.set(k, v);
      return this;
    }
    if (this.constructor.rawAttributes[key]) {
      this.dataValues[key] = value;
      this._changed.add(key);
    } else {
      this[key] = value;
    }
    return this;
  }

  changed(key) {
    if (key) return this._changed.has(key);
    return this._changed.size ? [...this._changed] : false;
  }

  toJSON() {
    const out = { ...this.dataValues };
    for (const alias of this._includes) {
      const v = this[alias];
      if (Array.isArray(v)) out[alias] = v.map((x) => (x && x.toJSON ? x.toJSON() : x));
      else out[alias] = v && v.toJSON ? v.toJSON() : v;
    }
    return out;
  }

  async _validate(onlyChanged) {
    const M = this.constructor;
    const errors = [];
    for (const [name, attr] of Object.entries(M.rawAttributes)) {
      if (onlyChanged && !this._changed.has(name)) continue;
      const v = this.dataValues[name];
      const empty = v === null || v === undefined;
      if (empty) {
        if (attr.allowNull === false && !attr.primaryKey) {
          errors.push({ message: `${M.name}.${name} cannot be null`, path: name, type: 'notNull Violation' });
        }
        continue;
      }
      if (attr.typeInfo.kind === 'ENUM' && !attr.typeInfo.values.includes(v)) {
        throw ormError('SequelizeDatabaseError', `invalid input value for enum "${M.name}"."${name}": "${v}"`);
      }
      const val = attr.validate || {};
      if (val.isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) {
        errors.push({ message: 'Validation isEmail on email failed', path: name, type: 'Validation error' });
      }
      if (val.min !== undefined && Number(v) < val.min) {
        errors.push({ message: `Validation min on ${name} failed`, path: name, type: 'Validation error' });
      }
      if (val.max !== undefined && Number(v) > val.max) {
        errors.push({ message: `Validation max on ${name} failed`, path: name, type: 'Validation error' });
      }
    }
    if (errors.length) throw validationError(errors);
  }

  async _runHooks(names, options) {
    const hooks = this.constructor.options.hooks || {};
    for (const n of names) {
      const hook = hooks[n];
      if (!hook) continue;
      const fns = Array.isArray(hook) ? hook : [hook];
      for (const fn of fns) await fn(this, options);
    }
  }

  // Serialises the changed (or all, for new rows) values and stages them.
  async _write(tx, base, options = {}) {
    const M = this.constructor;
    const nowIso = new Date().toISOString();
    const isNew = this.isNewRecord;

    if (!options._skipHooks) {
      await this._runHooks(['beforeValidate'], options);
      await this._validate(!isNew);
      await this._runHooks(isNew ? ['beforeCreate', 'beforeSave'] : ['beforeUpdate', 'beforeSave'], options);
    }
    await this._validate(!isNew);

    let raw;
    if (isNew) {
      raw = {};
      if (M.timestamps) {
        if (!this._changed.has('createdAt') || !this.dataValues.createdAt) this.dataValues.createdAt = new Date(nowIso);
        this.dataValues.updatedAt = new Date(nowIso);
      }
      for (const [name, attr] of Object.entries(M.rawAttributes)) {
        raw[name] = serializeValue(attr, this.dataValues[name]);
      }
    } else {
      const fields = [...this._changed].filter((f) => M.rawAttributes[f]);
      if (!fields.length && !options.force) return this;
      raw = { ...base.raw };
      for (const f of fields) raw[f] = serializeValue(M.rawAttributes[f], this.dataValues[f]);
      if (M.timestamps) {
        raw.updatedAt = nowIso;
        this.dataValues.updatedAt = new Date(nowIso);
      }
    }

    const id = String(raw[M.primaryKey]);
    if (isNew) {
      // eager unique check so callers see the error at create() time
      const view = await tx.view(M.tableName);
      for (const def of M.uniqueDefs) {
        const nv = uniqueValue(def, raw);
        if (nv === null) continue;
        for (const [rid, rraw] of view.rows) {
          if (rid !== id && uniqueValue(def, rraw) === nv) {
            throw ormError('SequelizeUniqueConstraintError', `${def.name} must be unique`, {
              errors: [{ message: `${def.name} must be unique`, path: def.name, type: 'unique violation' }],
              fields: { [def.name]: true },
            });
          }
        }
      }
      tx.stage(M, id, raw, null);
    } else {
      tx.stage(M, id, raw, base);
    }

    this.dataValues[M.primaryKey] = this.dataValues[M.primaryKey] ?? id;
    // reflect DB-normalised values (e.g. DECIMAL -> "12.50") like Postgres' RETURNING does
    for (const name of Object.keys(M.rawAttributes)) {
      if (name in raw && M.rawAttributes[name].typeInfo.kind === 'DECIMAL') {
        this.dataValues[name] = deserializeValue(M.rawAttributes[name], raw[name]);
      }
    }
    this.isNewRecord = false;
    this._changed.clear();
    return this;
  }

  async save(options = {}) {
    const M = this.constructor;
    if (this.isNewRecord) {
      const tx = options.transaction || new Transaction();
      try {
        await this._write(tx, null, options);
        if (!options.transaction) await tx.commit();
      } catch (err) {
        this.isNewRecord = true;
        throw err;
      }
      return this;
    }
    const id = String(this.dataValues[M.primaryKey]);
    const changedKeys = [...this._changed];
    let hooksDone = false;
    await withTx(options, async (tx) => {
      // re-read the freshest committed row so only the changed columns are overwritten
      const view = await tx.view(M.tableName);
      if (!view.rows.has(id)) {
        throw ormError('SequelizeEmptyResultError', `${M.name} not found`);
      }
      const base = { raw: view.rows.get(id), v: view.vers.get(id) || 1 };
      changedKeys.forEach((k) => this._changed.add(k));
      await this._write(tx, base, { ...options, _skipHooks: hooksDone });
      hooksDone = true;
    });
    return this;
  }

  async update(values, options = {}) {
    for (const [k, v] of Object.entries(values || {})) {
      if (v !== undefined) this.set(k, v); // undefined values are ignored, like Sequelize
    }
    return this.save(options);
  }

  async reload(options = {}) {
    const M = this.constructor;
    const fresh = await M.findByPk(this.dataValues[M.primaryKey], options);
    if (!fresh) throw ormError('SequelizeEmptyResultError', `${M.name} not found`);
    this.dataValues = fresh.dataValues;
    this._changed.clear();
    return this;
  }

  async destroy(options = {}) {
    const M = this.constructor;
    const id = String(this.dataValues[M.primaryKey]);
    await withTx(options, async (tx) => {
      const view = await tx.view(M.tableName);
      if (!view.rows.has(id)) return;
      await M._deleteRow(tx, id, view.rows.get(id), view.vers.get(id) || 1);
    });
  }
}

// ──────────────────────── define ────────────────────────

const define = (name, attributes, options = {}) => {
  class M extends Model {}
  Object.defineProperty(M, 'name', { value: name });
  M.modelName = name;
  const defaultTable = `${name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()}s`;
  M.tableName = options.tableName || defaultTable;
  M.options = options;
  M.associations = {};
  M.timestamps = options.timestamps !== false;
  M.rawAttributes = {};
  M.primaryKey = 'id';

  for (const [fieldName, def] of Object.entries(attributes)) {
    const full = def && typeof def === 'object' && 'type' in def ? def : { type: def };
    M.rawAttributes[fieldName] = {
      ...full,
      fieldName,
      typeInfo: resolveType(full.type),
    };
    if (full.primaryKey) M.primaryKey = fieldName;
  }
  if (M.timestamps) {
    for (const f of ['createdAt', 'updatedAt']) {
      if (!M.rawAttributes[f]) {
        M.rawAttributes[f] = { type: 'DATE', fieldName: f, typeInfo: { kind: 'DATE' }, allowNull: true };
      }
    }
  }
  if (!M.rawAttributes.id && !Object.values(M.rawAttributes).some((a) => a.primaryKey)) {
    M.rawAttributes.id = { fieldName: 'id', typeInfo: { kind: 'UUID' }, primaryKey: true, defaultValue: { __default: 'uuidv4' } };
  }

  // unique indexes: attribute-level `unique: true` and composite index definitions
  M.uniqueDefs = [];
  for (const [fieldName, attr] of Object.entries(M.rawAttributes)) {
    if (attr.unique) M.uniqueDefs.push({ name: fieldName, fields: [fieldName] });
  }
  for (const idx of options.indexes || []) {
    if (idx.unique && idx.fields) {
      const fields = idx.fields.map(snakeToCamel);
      M.uniqueDefs.push({ name: fields.join('_'), fields });
    }
  }

  for (const fieldName of Object.keys(M.rawAttributes)) {
    Object.defineProperty(M.prototype, fieldName, {
      get() {
        return this.dataValues[fieldName];
      },
      set(v) {
        this.dataValues[fieldName] = v;
        this._changed.add(fieldName);
      },
      enumerable: true,
      configurable: true,
    });
  }

  registry.set(M.tableName, M);
  return M;
};

module.exports = { Model, define, Transaction, registry, ORM_NAME, serializeValue, uniqueValue };
