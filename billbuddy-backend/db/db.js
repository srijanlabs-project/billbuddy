const { Pool } = require("pg");
require("dotenv").config();

/*
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "billbuddy",
  password: process.env.DB_PASSWORD || "billbuddy1003",
  port: Number(process.env.DB_PORT || 5432)
});
*/

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "billbuddy",
  password: process.env.DB_PASSWORD || "Rahul@1203",
  port: Number(process.env.DB_PORT || 5432)
});

module.exports = pool;
