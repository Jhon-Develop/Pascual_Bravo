import { useState, useCallback, useEffect } from 'react';
import { getApiClient, ApiRequestError } from '../api';
import type { Group, CreateGroupRequest, UpdateGroupRequest, GroupMember, InviteMemberRequest, Invitation, PaginatedResponse, PaginationParams, MemberRole } from '../api/types';

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = getApiClient();

  const fetchGroups = useCallback(async (params?: PaginationParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getGroups(params);
      setGroups(response.data);
      return response;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al cargar grupos');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  const createGroup = useCallback(async (data: CreateGroupRequest) => {
    setError(null);
    try {
      const group = await api.createGroup(data);
      setGroups((prev) => [group, ...prev]);
      return group;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al crear grupo');
      }
      throw err;
    }
  }, [api]);

  const updateGroup = useCallback(async (id: string, data: UpdateGroupRequest) => {
    setError(null);
    try {
      const group = await api.updateGroup(id, data);
      setGroups((prev) => prev.map((g) => (g.id === id ? group : g)));
      return group;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al actualizar grupo');
      }
      throw err;
    }
  }, [api]);

  const deleteGroup = useCallback(async (id: string) => {
    setError(null);
    try {
      await api.deleteGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al eliminar grupo');
      }
      throw err;
    }
  }, [api]);

  const inviteMember = useCallback(async (groupId: string, data: InviteMemberRequest) => {
    setError(null);
    try {
      return await api.inviteMember(groupId, data);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al invitar miembro');
      }
      throw err;
    }
  }, [api]);

  const getInvitations = useCallback(async (groupId: string) => {
    setError(null);
    try {
      return await api.getGroupInvitations(groupId);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al cargar invitaciones');
      }
      throw err;
    }
  }, [api]);

  const revokeInvitation = useCallback(async (groupId: string, invitationId: string) => {
    setError(null);
    try {
      await api.revokeInvitation(groupId, invitationId);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al revocar invitación');
      }
      throw err;
    }
  }, [api]);

  const removeMember = useCallback(async (groupId: string, memberId: string) => {
    setError(null);
    try {
      await api.removeMember(groupId, memberId);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al remover miembro');
      }
      throw err;
    }
  }, [api]);

  const updateMemberRole = useCallback(async (groupId: string, memberId: string, role: MemberRole) => {
    setError(null);
    try {
      return await api.updateMemberRole(groupId, memberId, role);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al actualizar rol');
      }
      throw err;
    }
  }, [api]);

  const clearError = useCallback(() => setError(null), []);

  return {
    groups,
    isLoading,
    error,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    inviteMember,
    getInvitations,
    revokeInvitation,
    removeMember,
    updateMemberRole,
    clearError,
  };
}

export function useGroup(groupId: string | null) {
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = getApiClient();

  const fetchGroup = useCallback(async () => {
    if (!groupId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getGroup(groupId);
      setGroup(data);
      return data;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Error al cargar grupo');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [api, groupId]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  const clearError = useCallback(() => setError(null), []);

  return {
    group,
    isLoading,
    error,
    refetch: fetchGroup,
    clearError,
  };
}