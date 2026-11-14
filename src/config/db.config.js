// Database connection. Data now lives in Redis (Vercel KV / Upstash / any Redis):
//   REDIS_URL=rediss://default:<password>@<host>:<port>
// The ORM layer in src/orm keeps the Sequelize-style API the models/controllers already use.
const { Sequelize } = require('../orm');

module.exports = new Sequelize();
