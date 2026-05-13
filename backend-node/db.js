// Database connection pool (mysql2/promise)
const mysql = require("mysql2/promise");
require("dotenv").config();

const dbHost = process.env.DB_HOST || "127.0.0.1";

const pool = mysql.createPool({
  host: dbHost === "localhost" ? "127.0.0.1" : dbHost,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  dateStrings: true,
});

async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function one(sql, params) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, one, tx };
