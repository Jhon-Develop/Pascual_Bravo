import { useState, useCallback, useEffect } from 'react';
import { getApiClient, ApiRequestError } from '../api';
import type { Expense, CreateExpenseRequest, UpdateExpenseRequest, ExpenseFilters, PaginatedResponse, Category } from '../api/types';

export function useExpenses(groupId?: string) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const api = getApiClient();

  const fetchExpenses = useCallback(async (params?: ExpenseFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams: ExpenseFilters = {
        ...params,
        groupId: groupId || params?.groupId,
      };
      const response = await api.getExpenses(queryParams);
      setExpenses(params?.page && params.page > 1 ? (prev) => [...prev, ...response.data] : response.data);
      setPagination(response.meta);
      return response;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al cargar gastos');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [api, groupId]);

  const createExpense = useCallback(async (data: CreateExpenseRequest) => {
    setError(null);
    try {
      const expense = await api.createExpense(data);
      setExpenses((prev) => [expense, ...prev]);
      setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
      return expense;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al crear gasto');
      }
      throw err;
    }
  }, [api]);

  const updateExpense = useCallback(async (id: string, data: UpdateExpenseRequest) => {
    setError(null);
    try {
      const expense = await api.updateExpense(id, data);
      setExpenses((prev) => prev.map((e) => (e.id === id ? expense : e)));
      return expense;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al actualizar gasto');
      }
      throw err;
    }
  }, [api]);

  const deleteExpense = useCallback(async (id: string) => {
    setError(null);
    try {
      await api.deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      setPagination((prev) => ({ ...prev, total: prev.total - 1 }));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al eliminar gasto');
      }
      throw err;
    }
  }, [api]);

  const getCategories = useCallback(async () => {
    setError(null);
    try {
      return await api.getCategories();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al cargar categorías');
      }
      throw err;
    }
  }, [api]);

  const loadMore = useCallback(async (params?: Omit<ExpenseFilters, 'page'>) => {
    if (pagination.page < pagination.totalPages && !isLoading) {
      await fetchExpenses({ ...params, page: pagination.page + 1 });
    }
  }, [fetchExpenses, pagination.page, pagination.totalPages, isLoading]);

  const clearError = useCallback(() => setError(null), []);

  return {
    expenses,
    isLoading,
    error,
    pagination,
    fetchExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    getCategories,
    loadMore,
    clearError,
  };
}

export function useExpense(expenseId: string | null) {
  const [expense, setExpense] = useState<Expense | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = getApiClient();

  const fetchExpense = useCallback(async () => {
    if (!expenseId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getExpense(expenseId);
      setExpense(data);
      return data;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al cargar gasto');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [api, expenseId]);

  useEffect(() => {
    fetchExpense();
  }, [fetchExpense]);

  const clearError = useCallback(() => setError(null), []);

  return {
    expense,
    isLoading,
    error,
    refetch: fetchExpense,
    clearError,
  };
}