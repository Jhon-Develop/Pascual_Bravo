import { useState, useCallback, useEffect } from 'react';
import { getApiClient, ApiRequestError } from '../api';
import type { Settlement, CreateSettlementRequest, PaginatedResponse, PaginationParams } from '../api/types';

export function useSettlements(groupId?: string) {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const api = getApiClient();

  const fetchSettlements = useCallback(async (params?: PaginationParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getSettlements({ ...params, groupId });
      setSettlements(params?.page && params.page > 1 ? (prev) => [...prev, ...response.data] : response.data);
      setPagination(response.meta);
      return response;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al cargar liquidaciones');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [api, groupId]);

  const createSettlement = useCallback(async (data: CreateSettlementRequest) => {
    setError(null);
    try {
      const settlement = await api.createSettlement(data);
      setSettlements((prev) => [settlement, ...prev]);
      setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
      return settlement;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al crear liquidación');
      }
      throw err;
    }
  }, [api]);

  const confirmSettlement = useCallback(async (settlementId: string) => {
    setError(null);
    try {
      const settlement = await api.confirmSettlement(settlementId);
      setSettlements((prev) => prev.map((s) => (s.id === settlementId ? settlement : s)));
      return settlement;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al confirmar liquidación');
      }
      throw err;
    }
  }, [api]);

  const disputeSettlement = useCallback(async (settlementId: string, reason: string) => {
    setError(null);
    try {
      const settlement = await api.disputeSettlement(settlementId, reason);
      setSettlements((prev) => prev.map((s) => (s.id === settlementId ? settlement : s)));
      return settlement;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al disputar liquidación');
      }
      throw err;
    }
  }, [api]);

  const loadMore = useCallback(async (params?: Omit<PaginationParams, 'page'>) => {
    if (pagination.page < pagination.totalPages && !isLoading) {
      await fetchSettlements({ ...params, page: pagination.page + 1 });
    }
  }, [fetchSettlements, pagination.page, pagination.totalPages, isLoading]);

  const clearError = useCallback(() => setError(null), []);

  return {
    settlements,
    isLoading,
    error,
    pagination,
    fetchSettlements,
    createSettlement,
    confirmSettlement,
    disputeSettlement,
    loadMore,
    clearError,
  };
}