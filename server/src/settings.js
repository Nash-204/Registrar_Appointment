import { pool } from './db.js';
import { parseSettings, serialize } from './settingsLogic.js';

export async function getSettings(db = pool) {
  const [rows] = await db.query('SELECT setting_key k, setting_value v FROM settings');
  return parseSettings(rows);
}

export async function saveSettings(changed) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const [k, v] of Object.entries(changed))
      await conn.query('INSERT INTO settings (setting_key, setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)', [k, serialize(v)]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}
