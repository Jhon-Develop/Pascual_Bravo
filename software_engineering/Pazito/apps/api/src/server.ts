import { createServer } from 'node:http';
import { createApp, logger } from './app.js';
import { env } from './config/env.js';
import { closeDatabase } from './infrastructure/database/client.js';

const app = createApp();
const server = createServer(app);
server.listen(env.API_PORT, env.API_HOST, () => logger.info({ host: env.API_HOST, port: env.API_PORT, environment: env.NODE_ENV }, 'Pazito API escuchando'));
let closing = false;
async function shutdown(signal: string) {
  if (closing) return; closing = true; logger.info({ signal }, 'Cerrando API');
  const timeout = setTimeout(() => { logger.error('Timeout cerrando conexiones'); process.exit(1); }, 10_000).unref();
  server.close(async error => {
    clearTimeout(timeout);
    try { await closeDatabase(); } catch (dbError) { logger.error({ err: dbError }, 'Error cerrando DB'); }
    if (error) { logger.error({ err: error }, 'Error cerrando HTTP'); process.exitCode = 1; }
    process.exit();
  });
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
