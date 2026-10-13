import type { ConnectionOptions } from 'mysql2';
import { env } from '../../config/env.js';

export function mysqlConnectionOptions(): ConnectionOptions {
  const url = new URL(env.DATABASE_URL);
  if (url.protocol !== 'mysql:') throw new Error('DATABASE_URL debe usar el protocolo mysql://');
  return {
    host: url.hostname, port: url.port ? Number(url.port) : 3306, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')), timezone: 'Z', charset: 'utf8mb4',
    supportBigNumbers: true, bigNumberStrings: true, decimalNumbers: false, enableKeepAlive: true,
  };
}
