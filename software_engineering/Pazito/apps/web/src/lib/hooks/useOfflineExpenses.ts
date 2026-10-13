import { useState, useCallback, useEffect, useRef } from 'react';
import { useOnlineStatus, usePendingCount } from '../offline';
import type { CreateExpenseRequest, Expense } from '../api/types';
import { getApiClient } from '../api/client';

interface OfflineExpenseState {
  isOffline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncError: string | null;
}

export function useOfflineExpenses() {
  const isOnline = useOnlineStatus();
  const pendingCount = usePendingCount();
  const [syncState, setSyncState] = useState<OfflineExpenseState>({
    isOffline: !isOnline,
    pendingCount,
    isSyncing: false,
    lastSyncError: null,
  });
  const api = getApiClient();
  const syncInFlight = useRef(false);

  // Update sync state when online status or pending count changes
  useEffect(() => {
    setSyncState((prev) => ({
      ...prev,
      isOffline: !isOnline,
      pendingCount,
    }));
  }, [isOnline, pendingCount]);

  const createExpenseOffline = useCallback(async (
    data: Omit<CreateExpenseRequest, 'idempotencyKey'> & { idempotencyKey?: string }
  ): Promise<{ localId: string; idempotencyKey: string }> => {
    const idempotencyKey = data.idempotencyKey || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `idem-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);

    // Resolve currency from explicit input first, then the locally cached group.
    // This avoids silently forcing COP when the user is offline in a foreign-currency group.
    const { saveExpenseOffline, getCachedGroup } = await import('../offline');
    const cachedGroup = data.currency ? undefined : await getCachedGroup(data.groupId);
    const currency = data.currency || cachedGroup?.currency || 'COP';

    const offlineExpense = await saveExpenseOffline({
      groupId: data.groupId,
      title: data.title,
      description: data.description,
      amountMinor: data.amountMinor,
      currency,
      paidBy: data.paidBy,
      splitType: data.splitType,
      splits: data.splits,
      categoryId: data.categoryId,
      date: data.date,
      idempotencyKey,
    });

    return {
      localId: offlineExpense.id,
      idempotencyKey: offlineExpense.idempotencyKey,
    };
  }, []);

  const syncPendingExpenses = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (syncInFlight.current) return { synced: 0, failed: 0 };
    if (!isOnline) {
      setSyncState((prev) => ({ ...prev, lastSyncError: 'Sin conexión a internet' }));
      return { synced: 0, failed: 0 };
    }

    syncInFlight.current = true;
    setSyncState((prev) => ({ ...prev, isSyncing: true, lastSyncError: null }));

    let synced = 0;
    let failed = 0;

    try {
      const { getAllPendingForSync, getOfflineExpense, markExpenseSynced, markExpenseSyncFailed } = await import('../offline');
      const { operations } = await getAllPendingForSync();

      for (const operation of operations) {
        if (operation.status !== 'pending' && operation.status !== 'failed') continue;

        try {
          const { markOperationSyncing, markOperationSynced, markOperationFailed } = await import('../offline');
          await markOperationSyncing(operation.id);

          let serverResponse: Expense | undefined;

          switch (operation.type) {
            case 'create_expense': {
              const offlineExpense = operation.payload as import('../offline').OfflineExpense;
              serverResponse = await api.createExpense({
                groupId: offlineExpense.groupId,
                title: offlineExpense.title,
                description: offlineExpense.description,
                amountMinor: offlineExpense.amountMinor,
                currency: offlineExpense.currency,
                paidBy: offlineExpense.paidBy,
                splitType: offlineExpense.splitType,
                splits: offlineExpense.splits,
                categoryId: offlineExpense.categoryId,
                date: offlineExpense.date,
                idempotencyKey: operation.idempotencyKey,
              });
              break;
            }

            case 'update_expense': {
              // The server ID may be assigned by an earlier queued create operation,
              // so always read the latest stored record immediately before updating.
              const offlineExpense = await getOfflineExpense(operation.entityId);
              if (!offlineExpense?.serverId) {
                throw new Error('No se puede actualizar el gasto: falta el identificador del servidor.');
              }
              serverResponse = await api.updateExpense(offlineExpense.serverId, {
                title: offlineExpense.title,
                description: offlineExpense.description,
                amountMinor: offlineExpense.amountMinor,
                currency: offlineExpense.currency,
                splitType: offlineExpense.splitType,
                splits: offlineExpense.splits,
                categoryId: offlineExpense.categoryId,
                date: offlineExpense.date,
              }, operation.idempotencyKey);
              break;
            }

            case 'delete_expense': {
              const { id: serverId } = operation.payload as { id: string };
              await api.deleteExpense(serverId, operation.idempotencyKey);
              break;
            }

            default:
              throw new Error(`Operación offline no soportada: ${operation.type}`);
          }

          if (serverResponse || operation.type === 'delete_expense') {
            if (operation.type === 'create_expense' && serverResponse) {
              await markExpenseSynced(operation.entityId, serverResponse.id);
            } else if (operation.type === 'update_expense' && serverResponse) {
              await markExpenseSynced(operation.entityId, serverResponse.id);
            } else if (operation.type === 'delete_expense') {
              // For delete, the local item is already removed; only the outbox row remains.
            }
            await markOperationSynced(operation.id);
            synced++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          await import('../offline').then(({ markExpenseSyncFailed, markOperationFailed }) => {
            if (operation.type !== 'delete_expense') {
              markExpenseSyncFailed(operation.entityId, errorMessage);
            }
            markOperationFailed(operation.id, errorMessage);
          });
          failed++;
          console.error(`Failed to sync operation ${operation.id}:`, error);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error durante la sincronización';
      setSyncState((prev) => ({ ...prev, lastSyncError: errorMessage }));
      failed = pendingCount;
    } finally {
      syncInFlight.current = false;
      setSyncState((prev) => ({ ...prev, isSyncing: false }));
    }

    return { synced, failed };
  }, [isOnline, pendingCount, api]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      const timer = setTimeout(() => {
        syncPendingExpenses();
      }, 1000); // Small delay to let connection stabilize

      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, syncPendingExpenses]);

  return {
    isOffline: !isOnline,
    pendingCount,
    isSyncing: syncState.isSyncing,
    lastSyncError: syncState.lastSyncError,
    createExpenseOffline,
    syncPendingExpenses,
  };
}