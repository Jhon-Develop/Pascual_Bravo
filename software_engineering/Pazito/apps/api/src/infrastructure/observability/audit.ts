import { randomUUID } from 'node:crypto';
import { db } from '../database/client.js';
import { auditEvents } from '../database/schema.js';

type AuditInput = { requestId?: string; actorUserId?: string | null; action: string; resourceType: string; resourceId?: string | null; outcome?: 'success' | 'denied' | 'failure'; metadata?: Record<string, unknown> };
export async function auditEvent(input: AuditInput, executor: typeof db | any = db): Promise<void> {
  // Metadata must contain IDs/status only; do not place credentials, content or full financial payloads here.
  await executor.insert(auditEvents).values({ id: randomUUID(), requestId: input.requestId ?? null, actorUserId: input.actorUserId ?? null,
    action: input.action, resourceType: input.resourceType, resourceId: input.resourceId ?? null, outcome: input.outcome ?? 'success', metadata: input.metadata ?? null });
}
