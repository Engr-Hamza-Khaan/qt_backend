// Redis storage engine.
//
// Layout (PREFIX defaults to "qt"):
//   qt:t:<table>        HASH  id -> JSON row
//   qt:v:<table>        HASH  id -> row version (integer, used for optimistic locking)
//   qt:u:<table>:<name> HASH  unique value -> id (unique indexes)
//   qt:ver              HASH  table -> change counter (lets every process know when its cache is stale)
//
// All writes go through one Lua script so a batch of row writes is atomic, checked against
// the row versions the caller read, and unique-constraint safe.

const Redis = require('ioredis');
require('dotenv').config();

const PREFIX = process.env.REDIS_PREFIX || 'qt';
const tableKey = (t) => `${PREFIX}:t:${t}`;
const versionKey = (t) => `${PREFIX}:v:${t}`;
const VER_KEY = `${PREFIX}:ver`;

const COMMIT_LUA = `
local prefix = ARGV[1]
local n = tonumber(ARGV[2])
local p = 3
local ops = {}
for i = 1, n do
  local op = {}
  op.t = ARGV[p]; op.id = ARGV[p + 1]; op.ev = tonumber(ARGV[p + 2]); op.mode = ARGV[p + 3]; op.j = ARGV[p + 4]
  local ns = tonumber(ARGV[p + 5]); p = p + 6
  op.us = {}
  for k = 1, ns do op.us[k] = { ARGV[p], ARGV[p + 1] }; p = p + 2 end
  local nd = tonumber(ARGV[p]); p = p + 1
  op.ud = {}
  for k = 1, nd do op.ud[k] = { ARGV[p], ARGV[p + 1] }; p = p + 2 end
  ops[i] = op
end
local claimed = {}
for i, op in ipairs(ops) do
  if op.ev >= 0 then
    local cur = redis.call('HGET', prefix .. ':v:' .. op.t, op.id)
    local curv = 0
    if cur then curv = tonumber(cur) end
    if curv ~= op.ev then return 'V|' .. op.t .. '|' .. op.id end
  end
  for _, u in ipairs(op.us) do
    local uk = prefix .. ':u:' .. op.t .. ':' .. u[1]
    local owner = redis.call('HGET', uk, u[2])
    local ck = uk .. '|' .. u[2]
    if (owner and owner ~= op.id) or (claimed[ck] and claimed[ck] ~= op.id) then
      return 'U|' .. op.t .. '|' .. u[1]
    end
    claimed[ck] = op.id
  end
end
for i, op in ipairs(ops) do
  local dk = prefix .. ':t:' .. op.t
  local vk = prefix .. ':v:' .. op.t
  for _, u in ipairs(op.ud) do
    local uk = prefix .. ':u:' .. op.t .. ':' .. u[1]
    if redis.call('HGET', uk, u[2]) == op.id then redis.call('HDEL', uk, u[2]) end
  end
  if op.mode == 'del' then
    redis.call('HDEL', dk, op.id)
    redis.call('HDEL', vk, op.id)
  else
    redis.call('HSET', dk, op.id, op.j)
    redis.call('HINCRBY', vk, op.id, 1)
  end
  for _, u in ipairs(op.us) do
    local uk = prefix .. ':u:' .. op.t .. ':' .. u[1]
    redis.call('HSET', uk, u[2], op.id)
  end
  redis.call('HINCRBY', prefix .. ':ver', op.t, 1)
end
return 'OK'
`;

let client = null;

const getRedis = () => {
  if (client) return client;
  if (process.env.REDIS_MOCK === '1') {
    const RedisMock = require('ioredis-mock');
    client = new RedisMock();
  } else {
    const url = process.env.REDIS_URL || process.env.KV_URL || process.env.UPSTASH_REDIS_URL;
    if (!url) {
      throw new Error('REDIS_URL is not set. Add your Vercel/Upstash Redis connection string to .env');
    }
    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      tls: url.startsWith('rediss://') ? {} : undefined,
    });
    client.on('error', (err) => console.error('[redis] connection error:', err.message));
  }
  client.defineCommand('qtCommit', { numberOfKeys: 0, lua: COMMIT_LUA });
  return client;
};

// In-process cache: table -> { ver, checkedAt, rows: Map<id, raw>, vers: Map<id, number> }
// Reads within CACHE_TTL_MS reuse the cached table without touching Redis (this keeps the number of
// Redis commands low, which matters on metered hosts such as Upstash/Vercel). Writes made by this
// process invalidate the cache immediately; writes from other instances are picked up within the TTL.
// Correctness of writes never depends on the cache: the Lua commit checks real row versions.
const CACHE_TTL_MS = Number(process.env.REDIS_CACHE_TTL_MS ?? 1500);
const cache = new Map();

const loadTable = async (table) => {
  const r = getRedis();
  const now = Date.now();
  const cached = cache.get(table);
  if (cached && now - cached.checkedAt < CACHE_TTL_MS) return cached;

  const ver = String((await r.hget(VER_KEY, table)) || '0');
  const hit = cache.get(table);
  if (hit && hit.ver === ver) {
    hit.checkedAt = now;
    return hit;
  }

  const [data, vers] = await Promise.all([r.hgetall(tableKey(table)), r.hgetall(versionKey(table))]);
  const rows = new Map();
  const versions = new Map();
  for (const [id, json] of Object.entries(data || {})) {
    rows.set(id, JSON.parse(json));
    versions.set(id, parseInt((vers || {})[id] || '1', 10));
  }
  const entry = { ver, checkedAt: now, rows, vers: versions };
  cache.set(table, entry);
  return entry;
};

const makeError = (name, message, extra = {}) => {
  const err = new Error(message);
  err.name = name;
  Object.assign(err, extra);
  return err;
};

// ops: [{ t, id, ev, mode: 'set'|'del', json, us: [[name,value]], ud: [[name,value]] }]
const commitOps = async (ops) => {
  if (!ops.length) return;
  const args = [PREFIX, String(ops.length)];
  for (const op of ops) {
    args.push(op.t, op.id, String(op.ev), op.mode, op.json || '');
    args.push(String(op.us.length));
    op.us.forEach(([k, v]) => args.push(k, v));
    args.push(String(op.ud.length));
    op.ud.forEach(([k, v]) => args.push(k, v));
  }
  const res = await getRedis().qtCommit(...args);
  if (res === 'OK') {
    ops.forEach((op) => cache.delete(op.t)); // this process re-reads fresh data on the next query
    return;
  }
  const [kind, table, what] = String(res).split('|');
  ops.forEach((op) => cache.delete(op.t)); // our view was stale: force a fresh read before any retry
  if (kind === 'U') {
    throw makeError('SequelizeUniqueConstraintError', `${what} must be unique`, {
      errors: [{ message: `${what} must be unique`, path: what, type: 'unique violation' }],
      fields: { [what]: true },
    });
  }
  throw makeError(
    'SequelizeOptimisticLockError',
    `Another request changed this ${table} record at the same time. Please retry.`
  );
};

const clearCache = () => cache.clear();

const ping = async () => {
  await getRedis().ping();
  return true;
};

module.exports = { getRedis, loadTable, commitOps, clearCache, ping, makeError, tableKey, versionKey, PREFIX, VER_KEY };
