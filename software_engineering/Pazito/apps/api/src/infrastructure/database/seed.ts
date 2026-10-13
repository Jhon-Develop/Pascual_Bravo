import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { db, closeDatabase } from './client.js';
import { categories } from './schema.js';

const DEFAULTS = [
  ['Comida', 'utensils', '#14b8a6'], ['Transporte', 'car', '#3b82f6'], ['Servicios', 'zap', '#f59e0b'],
  ['Entretenimiento', 'film', '#8b5cf6'], ['Compras', 'shopping-bag', '#ec4899'], ['Vivienda', 'house', '#0891b2'], ['Viajes', 'plane', '#7c3aed'], ['Otros', 'more-horizontal', '#6b7280'],
] as const;

async function main() {
  const existing = await db.select().from(categories).where(isNull(categories.groupId));
  for (const [name, icon, color] of DEFAULTS) {
    if (existing.some(row => row.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) continue;
    await db.insert(categories).values({ id: randomUUID(), groupId: null, name, icon, color, isDefault: true, createdBy: null });
  }
  console.info('✓ Categorías predeterminadas listas. No se creó ninguna cuenta ni dato financiero de demostración.');
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Error de seed'); process.exitCode = 1; }).finally(() => closeDatabase());
