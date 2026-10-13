import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../../config/env.js';
import { mysqlConnectionOptions } from './connection-options.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '../../../database/migrations');

async function main() {
  const connection = await mysql.createConnection({ ...mysqlConnectionOptions(), multipleStatements: false });
  try {
    const [lockRows] = await connection.query<mysql.RowDataPacket[]>('SELECT GET_LOCK(?, 30) AS acquired', ['pazito_schema_migrations']);
    if (Number(lockRows[0]?.acquired) !== 1) throw new Error('No se pudo adquirir el bloqueo para ejecutar migraciones; inténtalo de nuevo.');
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB`);
    const [rows] = await connection.query<mysql.RowDataPacket[]>('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((row) => String(row.name)));
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (done.has(file)) { console.info(`↷ ${file} ya aplicada`); continue; }
      const source = await readFile(join(migrationsDir, file), 'utf8');
      const statements = source.split(/;\s*(?:\r?\n|$)/).map(s => s.trim()).filter(Boolean);
      console.info(`→ Aplicando ${file} (${statements.length} sentencias)`);
      for (const statement of statements) await connection.query(statement);
      await connection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      console.info(`✓ ${file}`);
    }
  } finally {
    await connection.query('SELECT RELEASE_LOCK(?)', ['pazito_schema_migrations']).catch(() => undefined);
    await connection.end();
  }
}
main().catch((error: unknown) => { console.error('Falló la migración:', error instanceof Error ? error.message : 'error inesperado'); process.exitCode = 1; });
