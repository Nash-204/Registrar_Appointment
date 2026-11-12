import 'dotenv/config';
import mysql from 'mysql2/promise';
import { localToday } from './time.js';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'civil_registry',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  queueLimit: 0,
  connectTimeout: 10000,
  enableKeepAlive: true,
  dateStrings: true, // DATE/TIME come back as plain strings
});

// Today's date in the office timezone, safely escaped for use inside SQL (instead of CURDATE(), which follows the database server's clock zone).
export const sqlToday = () => `'${localToday()}'`; // localToday() only ever returns digits and dashes

export const log = (actor, action) =>
  pool.query('INSERT INTO activity_logs (actor, action) VALUES (?, ?)', [actor, action]).catch(() => {});
