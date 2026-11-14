# Redis database

The backend now stores all data in Redis instead of PostgreSQL. Controllers and models were not
rewritten: `src/orm/` is a small Sequelize-compatible layer (same `findAll`, `include`, `where`,
transactions, hooks, validations) that reads and writes Redis.

## Setup

1. In Vercel, add a Redis store (Marketplace → Upstash Redis) and copy its **`rediss://`** connection
   string (the `KV_URL` / `REDIS_URL` value, not the REST URL).
2. Put it in `qt_backend/.env`:
   ```
   REDIS_URL=rediss://default:<password>@<host>:<port>
   ```
3. Start the server as usual (`npm run dev`). An empty Redis is seeded automatically, exactly like an
   empty PostgreSQL used to be.

## Moving the existing PostgreSQL data

Keep the old `DATABASE_URL` / `DB_*` values in `.env` and run once:

```
npm run migrate:pg-to-redis
```

It only reads from PostgreSQL. It refuses to run if Redis already has users (use `-- --force` to overwrite).

## How data is stored

| Key | Purpose |
| --- | --- |
| `qt:t:<table>` (hash) | one JSON document per row |
| `qt:v:<table>` (hash) | row version, used to detect concurrent edits |
| `qt:u:<table>:<field>` (hash) | unique indexes (email, SKU, order number, ...) |
| `qt:ver` (hash) | per-table change counter for cache invalidation |

- Reads load a whole table and filter in memory. This is fast for a store this size; if a table grows to
  hundreds of thousands of rows, move that table to a real query engine.
- Writes are atomic (one Lua script). If two requests change the same row at the same moment, one of them
  gets `SequelizeOptimisticLockError` (HTTP 500 with a "please retry" message) instead of silently
  overwriting the other.
- Reads are cached in memory for `REDIS_CACHE_TTL_MS` (default 1500 ms). Writes made by this server show up
  immediately; writes from another server instance show up within the TTL.

## Tests

```
npm run test:redis     # in-memory Redis mock, no server needed
```
