const { Pool } = require("pg");
require("dotenv").config();

if (!process.env.DB_PASSWORD) {
  throw new Error("DB_PASSWORD is required");
}

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "billbuddy",
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl:
    process.env.DB_SSL === "true"
      ? { rejectUnauthorized: false }
      : false,
  max: 20,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});

module.exports = pool;
