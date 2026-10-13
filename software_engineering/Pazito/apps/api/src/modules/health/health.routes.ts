import { Router } from 'express';
import { checkDatabase } from '../../infrastructure/database/client.js';
import { env } from '../../config/env.js';

export const healthRouter = Router();
healthRouter.get('/health', async (_req, res) => {
  const database = await checkDatabase();
  res.status(database ? 200 : 503).json({ status: database ? 'ok' : 'degraded', version: '0.2.0', timestamp: new Date().toISOString(), services: { database: database ? 'ok' : 'down', cache: 'ok' }, environment: env.NODE_ENV });
});
healthRouter.get('/health/live', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
healthRouter.get('/health/ready', async (_req, res) => {
  const database = await checkDatabase();
  res.status(database ? 200 : 503).json({ status: database ? 'ready' : 'not_ready', services: { database: database ? 'ok' : 'down' } });
});
