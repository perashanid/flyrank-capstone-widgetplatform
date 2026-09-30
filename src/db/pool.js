const { Pool } = require("pg");
const config = require("../config");

const pool = new Pool({ connectionString: config.databaseUrl });

pool.on("error", (err) => {
  // A dead idle client should not crash the process.
  console.error("Unexpected Postgres pool error:", err);
});

module.exports = pool;
