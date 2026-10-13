import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { env } from '../../config/env.js';
import * as schema from './schema.js';
import { mysqlConnectionOptions } from './connection-options.js';

export const pool = mysql.createPool({ ...mysqlConnectionOptions(), connectionLimit: env.DATABASE_POOL_SIZE, waitForConnections: true, queueLimit: 0 });
export const db = drizzle(pool, { schema, mode: 'default' });
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function checkDatabase(): Promise<boolean> {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}
export async function closeDatabase(): Promise<void> { await pool.end(); }
