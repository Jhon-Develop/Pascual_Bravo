import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
export default defineConfig({ dialect: 'mysql', schema: './src/infrastructure/database/schema.ts', out: './database/generated-migrations', dbCredentials: { url: process.env.DATABASE_URL ?? 'mysql://pazito:pazito_dev_only@127.0.0.1:3306/pazito' }, strict: true, verbose: true });
