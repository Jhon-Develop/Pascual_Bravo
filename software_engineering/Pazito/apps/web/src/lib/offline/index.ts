/**
 * Offline Module for Pazito
 * IndexedDB-based storage for offline expense capture with idempotency support
 * Provides a queue for pending operations and sync when online
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// ============================================
// Types
// ============================================

export interface OfflineExpense {
  id: string; // UUID generated client-side
  idempotencyKey: string; // Stable key for idempotent retry
  groupId: string;
  title: string;
  description?: string;
  amountMinor: number;
  currency: string;
  paidBy: string;
  splitType: 'equal' | 'custom' | 'percentage';
  splits: Array<{
    userId: string;
    amountMinor?: number;
    percentage?: number;
  }>;
  categoryId?: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO 8601
  synced: boolean;
  syncedAt?: string;
  serverId?: string; // ID assigned by server after sync
  lastSyncAttempt?: string;
  syncError?: string;
}

export interface PendingOperation {
  id: string;
  type: 'create_expense' | 'update_expense' | 'delete_expense' | 'create_settlement' | 'confirm_settlement' | 'dispute_settlement';
  entityId: string; // Local ID
  idempotencyKey: string;
  payload: unknown;
  createdAt: string;
  retryCount: number;
  lastAttempt?: string;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  error?: string;
}

export interface OfflineGroup {
  id: string;
  name: string;
  description?: string;
  currency: string;
  members: Array<{
    userId: string;
    name: string;
    avatarUrl?: string;
    role: string;
  }>;
  cachedAt: string;
}

export interface OfflineUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  groups: string[]; // Group IDs user has access to
  cachedAt: string;
}

// ============================================
// Database Schema
// ============================================

interface PazitoDB extends DBSchema {
  expenses: {
    key: string;
    value: OfflineExpense;
    indexes: { 'by-group': string; 'by-idempotency': string };
  };
  operations: {
    key: string;
    value: PendingOperation;
    indexes: { 'by-status': string; 'by-type': string; 'by-idempotency': string };
  };
  groups: {
    key: string;
    value: OfflineGroup;
    indexes: {};
  };
  user: {
    key: string;
    value: OfflineUser;
  };
  metadata: {
    key: string;
    value: { key: string; value: unknown; updatedAt: string };
  };
}

const DB_NAME = 'pazito-offline';
const DB_VERSION = 2;
const ANONYMOUS_DB_NAME = `${DB_NAME}-anonymous`;
let activeUserScope: string | null = null;
let activeDbName = ANONYMOUS_DB_NAME;
const QUEUE_CHANGED_EVENT = 'pazito:offline-queue-updated';
const QUEUE_CHANNEL_NAME = 'pazito-offline-queue';

function notifyQueueChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(QUEUE_CHANNEL_NAME);
    channel.postMessage({ type: 'changed', at: Date.now() });
    channel.close();
  }
}

// ============================================
// Database Instance
// ============================================

let dbInstance: IDBPDatabase<PazitoDB> | null = null;

/**
 * Select an account-specific IndexedDB database so cached financial data and
 * queued operations cannot appear when another user signs in on the same browser.
 * The legacy unscoped `pazito-offline` database is deliberately not auto-assigned
 * to an account because its records do not identify their owner reliably.
 */
export function setOfflineUserScope(userId: string | null): void {
  const normalizedUserId = userId?.trim() || null;
  if (normalizedUserId === activeUserScope) return;

  dbInstance?.close();
  dbInstance = null;
  activeUserScope = normalizedUserId;
  activeDbName = normalizedUserId
    ? `${DB_NAME}-user-${encodeURIComponent(normalizedUserId)}`
    : ANONYMOUS_DB_NAME;
}

export async function getDB(): Promise<IDBPDatabase<PazitoDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<PazitoDB>(activeDbName, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      // Upgrade existing local databases safely; createObjectStore on a v1
      // database would throw ConstraintError and strand offline data.
      const expenseStore = db.objectStoreNames.contains('expenses')
        ? transaction.objectStore('expenses')
        : db.createObjectStore('expenses', { keyPath: 'id' });
      if (!expenseStore.indexNames.contains('by-group')) expenseStore.createIndex('by-group', 'groupId');
      const legacyExpenseStore = expenseStore as unknown as IDBObjectStore;
      if (legacyExpenseStore.indexNames.contains('by-synced')) legacyExpenseStore.deleteIndex('by-synced');
      if (!expenseStore.indexNames.contains('by-idempotency')) {
        expenseStore.createIndex('by-idempotency', 'idempotencyKey', { unique: true });
      }

      const opStore = db.objectStoreNames.contains('operations')
        ? transaction.objectStore('operations')
        : db.createObjectStore('operations', { keyPath: 'id' });
      if (!opStore.indexNames.contains('by-status')) opStore.createIndex('by-status', 'status');
      if (!opStore.indexNames.contains('by-type')) opStore.createIndex('by-type', 'type');
      if (!opStore.indexNames.contains('by-idempotency')) {
        opStore.createIndex('by-idempotency', 'idempotencyKey', { unique: true });
      }

      if (!db.objectStoreNames.contains('groups')) db.createObjectStore('groups', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('user')) db.createObjectStore('user', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('metadata')) db.createObjectStore('metadata', { keyPath: 'key' });
    },
  });

  return dbInstance;
}

// ============================================
// Utility Functions
// ============================================

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `idem-${generateId()}`;
}

type NewPendingOperation = Omit<PendingOperation, 'id' | 'createdAt' | 'retryCount' | 'status'>;

function createPendingOperation(op: NewPendingOperation): PendingOperation {
  return { ...op, id: generateId(), createdAt: nowISO(), retryCount: 0, status: 'pending' };
}

function nowISO(): string {
  return new Date().toISOString();
}

// ============================================
// Expense Operations
// ============================================

export async function saveExpenseOffline(
  expense: Omit<OfflineExpense, 'id' | 'idempotencyKey' | 'createdAt' | 'synced' | 'syncedAt' | 'serverId' | 'lastSyncAttempt' | 'syncError'> & { idempotencyKey?: string }
): Promise<OfflineExpense> {
  const db = await getDB();
  const { idempotencyKey: suppliedIdempotencyKey, ...expenseData } = expense;
  const id = generateId();
  const idempotencyKey = suppliedIdempotencyKey || generateIdempotencyKey();
  const now = nowISO();

  const offlineExpense: OfflineExpense = {
    ...expenseData,
    id,
    idempotencyKey,
    createdAt: now,
    synced: false,
  };
  const operation = createPendingOperation({
    type: 'create_expense',
    entityId: id,
    idempotencyKey,
    payload: offlineExpense,
  });

  // Persist the expense and its outbox operation in one transaction. If either
  // write fails, IndexedDB rolls back both and cannot leave an unsynced orphan.
  const tx = db.transaction(['expenses', 'operations'], 'readwrite');
  await tx.objectStore('expenses').put(offlineExpense);
  await tx.objectStore('operations').put(operation);
  await tx.done;
  notifyQueueChanged();
  return offlineExpense;
}

export async function updateExpenseOffline(
  id: string,
  updates: Partial<OfflineExpense>
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('expenses', id);
  if (!existing) throw new Error('Expense not found');

  const updated: OfflineExpense = {
    ...existing,
    ...updates,
    id,
    idempotencyKey: existing.idempotencyKey,
    serverId: existing.serverId,
    synced: false,
  };
  const operation = createPendingOperation({
    type: 'update_expense',
    entityId: id,
    idempotencyKey: generateIdempotencyKey(),
    payload: updated,
  });

  const tx = db.transaction(['expenses', 'operations'], 'readwrite');
  await tx.objectStore('expenses').put(updated);
  await tx.objectStore('operations').put(operation);
  await tx.done;
  notifyQueueChanged();
}

export async function deleteExpenseOffline(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get('expenses', id);
  if (!existing) throw new Error('Expense not found');

  const tx = db.transaction(['expenses', 'operations'], 'readwrite');
  await tx.objectStore('expenses').delete(id);

  if (!existing.serverId) {
    // The expense never reached the server. Cancel its local create/update queue
    // instead of later creating and then deleting a record unnecessarily.
    const operations = await tx.objectStore('operations').getAll();
    for (const operation of operations) {
      if (operation.entityId === id && operation.status !== 'synced') {
        await tx.objectStore('operations').delete(operation.id);
      }
    }
  } else {
    const operation = createPendingOperation({
      type: 'delete_expense',
      entityId: id,
      idempotencyKey: generateIdempotencyKey(),
      payload: { id: existing.serverId, localId: id },
    });
    await tx.objectStore('operations').put(operation);
  }

  await tx.done;
  notifyQueueChanged();
}

export async function getOfflineExpense(id: string): Promise<OfflineExpense | undefined> {
  const db = await getDB();
  return db.get('expenses', id);
}

export async function getOfflineExpenses(groupId?: string): Promise<OfflineExpense[]> {
  const db = await getDB();
  if (groupId) {
    return db.getAllFromIndex('expenses', 'by-group', groupId);
  }
  return db.getAll('expenses');
}

export async function getPendingExpenses(): Promise<OfflineExpense[]> {
  const db = await getDB();
  // IndexedDB keys cannot be boolean values; filter records instead of using
  // a boolean index that cannot be queried reliably.
  return (await db.getAll('expenses')).filter((expense) => !expense.synced);
}

export async function getExpenseByIdempotencyKey(key: string): Promise<OfflineExpense | undefined> {
  const db = await getDB();
  return db.getFromIndex('expenses', 'by-idempotency', key);
}

export async function markExpenseSynced(
  id: string,
  serverId: string
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['expenses', 'operations'], 'readwrite');
  const expense = await tx.objectStore('expenses').get(id);
  if (!expense) {
    await tx.done;
    return;
  }

  expense.synced = true;
  expense.syncedAt = nowISO();
  expense.serverId = serverId;
  expense.syncError = undefined;
  await tx.objectStore('expenses').put(expense);

  const operations = await tx.objectStore('operations').index('by-idempotency').getAll(expense.idempotencyKey);
  for (const operation of operations) {
    if (operation.type === 'create_expense') {
      operation.status = 'synced';
      operation.error = undefined;
      await tx.objectStore('operations').put(operation);
    }
  }
  await tx.done;
  notifyQueueChanged();
}

export async function markExpenseSyncFailed(
  id: string,
  error: string
): Promise<void> {
  const db = await getDB();
  const expense = await db.get('expenses', id);
  if (!expense) return;

  expense.lastSyncAttempt = nowISO();
  expense.syncError = error;
  await db.put('expenses', expense);
  notifyQueueChanged();
}

// ============================================
// Operations Queue
// ============================================

export async function getPendingOperations(): Promise<PendingOperation[]> {
  const db = await getDB();
  return db.getAllFromIndex('operations', 'by-status', 'pending');
}

export async function getFailedOperations(): Promise<PendingOperation[]> {
  const db = await getDB();
  return db.getAllFromIndex('operations', 'by-status', 'failed');
}

export async function getOperationByIdempotencyKey(key: string): Promise<PendingOperation | undefined> {
  const db = await getDB();
  return db.getFromIndex('operations', 'by-idempotency', key);
}

export async function markOperationSyncing(id: string): Promise<void> {
  const db = await getDB();
  const op = await db.get('operations', id);
  if (!op) return;
  op.status = 'syncing';
  op.lastAttempt = nowISO();
  await db.put('operations', op);
  notifyQueueChanged();
}

export async function markOperationSynced(id: string): Promise<void> {
  const db = await getDB();
  const op = await db.get('operations', id);
  if (!op) return;
  op.status = 'synced';
  await db.put('operations', op);
  notifyQueueChanged();
}

export async function markOperationFailed(id: string, error: string): Promise<void> {
  const db = await getDB();
  const op = await db.get('operations', id);
  if (!op) return;
  op.status = 'failed';
  op.error = error;
  op.lastAttempt = nowISO();
  op.retryCount += 1;
  await db.put('operations', op);
  notifyQueueChanged();
}

// ============================================
// Group Caching
// ============================================

export async function cacheGroups(groups: OfflineGroup[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('groups', 'readwrite');
  for (const group of groups) {
    await tx.store.put({ ...group, cachedAt: nowISO() });
  }
  await tx.done;
}

export async function getCachedGroups(): Promise<OfflineGroup[]> {
  const db = await getDB();
  return db.getAll('groups');
}

export async function getCachedGroup(id: string): Promise<OfflineGroup | undefined> {
  const db = await getDB();
  return db.get('groups', id);
}

// ============================================
// User Caching
// ============================================

export async function cacheUser(user: OfflineUser): Promise<void> {
  const db = await getDB();
  await db.put('user', { ...user, cachedAt: nowISO() });
}

export async function getCachedUser(): Promise<OfflineUser | undefined> {
  const db = await getDB();
  const users = await db.getAll('user');
  return users[0];
}

export async function clearUserCache(): Promise<void> {
  const db = await getDB();
  await db.clear('user');
  // Don't clear expenses/groups - they may have pending operations
}

// ============================================
// Metadata
// ============================================

export async function setMetadata(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('metadata', { key, value, updatedAt: nowISO() });
}

export async function getMetadata(key: string): Promise<unknown> {
  const db = await getDB();
  const record = await db.get('metadata', key);
  return record?.value;
}

// ============================================
// Sync Helpers
// ============================================

export async function getAllPendingForSync(): Promise<{
  expenses: OfflineExpense[];
  operations: PendingOperation[];
}> {
  const db = await getDB();
  const allOperations = await db.getAll('operations');
  const staleBefore = Date.now() - 2 * 60 * 1000;
  const tx = db.transaction('operations', 'readwrite');
  const eligible: PendingOperation[] = [];

  for (const operation of allOperations) {
    // A closed tab/device can leave an operation marked as syncing forever.
    if (operation.status === 'syncing' && operation.lastAttempt && Date.parse(operation.lastAttempt) < staleBefore) {
      operation.status = 'pending';
      await tx.store.put(operation);
    }
    if (operation.status === 'pending' || operation.status === 'failed') eligible.push(operation);
  }
  await tx.done;

  const expenses = await getPendingExpenses();
  // Operations must run in creation order so create precedes update/delete for
  // the same local entity, regardless of their randomly generated primary keys.
  eligible.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return { expenses, operations: eligible };
}

export async function getUnresolvedOperations(): Promise<PendingOperation[]> {
  const db = await getDB();
  const operations = await db.getAll('operations');
  return operations.filter((operation) => ['pending', 'syncing', 'failed'].includes(operation.status));
}

export async function clearSyncedData(olderThanDays = 30): Promise<void> {
  const db = await getDB();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  // Delete synced expenses older than cutoff
  const expenses = await db.getAll('expenses');
  const tx = db.transaction('expenses', 'readwrite');
  for (const expense of expenses) {
    if (expense.synced && expense.syncedAt && expense.syncedAt < cutoff) {
      await tx.store.delete(expense.id);
    }
  }
  await tx.done;

  // Delete synced operations older than cutoff
  const operations = await db.getAllFromIndex('operations', 'by-status', 'synced');
  const opTx = db.transaction('operations', 'readwrite');
  for (const op of operations) {
    if (op.lastAttempt && op.lastAttempt < cutoff) {
      await opTx.store.delete(op.id);
    }
  }
  await opTx.done;
}

// ============================================
// Network Status
// ============================================

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnline(callback: () => void): () => void {
  window.addEventListener('online', callback);
  return () => window.removeEventListener('online', callback);
}

export function onOffline(callback: () => void): () => void {
  window.addEventListener('offline', callback);
  return () => window.removeEventListener('offline', callback);
}

// ============================================
// React Hook for Offline Status
// ============================================

import { useState, useEffect } from 'react';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

export function usePendingCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const updateCount = async () => {
      try {
        const operations = await getUnresolvedOperations();
        if (active) setCount(operations.length);
      } catch (error) {
        console.error('[Pazito] No se pudo leer la cola offline:', error);
      }
    };

    void updateCount();
    window.addEventListener('online', updateCount);
    window.addEventListener(QUEUE_CHANGED_EVENT, updateCount);

    const channel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(QUEUE_CHANNEL_NAME)
      : null;
    channel?.addEventListener('message', updateCount);

    return () => {
      active = false;
      window.removeEventListener('online', updateCount);
      window.removeEventListener(QUEUE_CHANGED_EVENT, updateCount);
      channel?.removeEventListener('message', updateCount);
      channel?.close();
    };
  }, []);

  return count;
}
