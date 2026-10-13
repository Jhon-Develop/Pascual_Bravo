import { useState, useCallback, useEffect } from 'react';
import { getApiClient, ApiRequestError } from '../api';
import type { GroupBalance, BalanceDetail } from '../api/types';

export function useGroupBalance(groupId: string | null) {
  const [balance, setBalance] = useState<GroupBalance | null>(null);
  const [detail, setDetail] = useState<BalanceDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = getApiClient();

  const fetchBalance = useCallback(async () => {
    if (!groupId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getGroupBalance(groupId);
      setBalance(data);
      return data;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al cargar balance');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [api, groupId]);

  const fetchDetail = useCallback(async () => {
    if (!groupId) return;
    setError(null);
    try {
      const data = await api.getBalanceDetail(groupId);
      setDetail(data);
      return data;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al cargar detalle de balance');
      }
      throw err;
    }
  }, [api, groupId]);

  useEffect(() => {
    fetchBalance();
    fetchDetail();
  }, [fetchBalance, fetchDetail]);

  const clearError = useCallback(() => setError(null), []);

  return {
    balance,
    detail,
    isLoading,
    error,
    refetch: () => {
      fetchBalance();
      fetchDetail();
    },
    clearError,
  };
}