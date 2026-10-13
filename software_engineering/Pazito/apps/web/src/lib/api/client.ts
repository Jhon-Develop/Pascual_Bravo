/**
 * API Client for Pazito
 * Typed HTTP client with error handling, request cancellation, and demo mode support.
 */

import type {
  ApiError,
  PaginatedResponse,
  PaginationParams,
  User,
  Session,
  RegisterRequest,
  LoginRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  Group,
  CreateGroupRequest,
  UpdateGroupRequest,
  GroupMember,
  MemberRole,
  InviteMemberRequest,
  Invitation,
  AcceptInvitationRequest,
  Expense,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  ExpenseFilters,
  Category,
  GroupBalance,
  BalanceDetail,
  Settlement,
  CreateSettlementRequest,
  ConfirmSettlementRequest,
  DisputeSettlementRequest,
  HealthCheckResponse,
} from './types';

// ============================================
// Configuration
// ============================================

const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL || '/api/v1';
// Opt-in demo can also be enabled for this browser session by the explicit demo route.
// Demo fixtures remain in memory and never reach the configured API/database.
let DEMO_MODE = import.meta.env.PUBLIC_DEMO_MODE === 'true';
const UNAUTHORIZED_EVENT = 'pazito:unauthorized';

let inMemoryAccessToken: string | null = null;
let demoAuthenticated = false;

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** Keep bearer credentials in memory only; never persist them to localStorage. */
export function setApiAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

function notifyUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
}

interface RequestOptions extends RequestInit {
  params?: object;
  signal?: AbortSignal;
  skipAuth?: boolean;
  idempotencyKey?: string;
}

interface ApiClientConfig {
  baseUrl: string;
  getAccessToken: () => string | null;
  onUnauthorized: () => void;
}

// ============================================
// Error Classes
// ============================================

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  static fromResponse(response: Response, data: ApiError): ApiRequestError {
    return new ApiRequestError(
      response.status,
      data.code,
      data.message,
      data.details
    );
  }

  isValidationError(): boolean {
    return this.status === 422 || this.status === 400;
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }

  isForbidden(): boolean {
    return this.status === 403;
  }

  isNotFound(): boolean {
    return this.status === 404;
  }

  isRateLimited(): boolean {
    return this.status === 429;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }

  isNetworkError(): boolean {
    return this.status === 0;
  }
}

export class ApiNetworkError extends Error {
  constructor(message: string = 'Error de conexión. Verifica tu internet.') {
    super(message);
    this.name = 'ApiNetworkError';
  }
}

// ============================================
// Demo Data (for development without backend)
// ============================================

const demoUser: User = {
  id: 'demo-user-1',
  email: 'demo@pazito.app',
  name: 'Usuario Demo',
  avatarUrl: undefined,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
};

const demoGroups: Group[] = [
  {
    id: 'group-1',
    name: 'Apartamento Compartido',
    description: 'Gastos del apartamento en Chapinero',
    currency: 'COP',
    createdBy: 'demo-user-1',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T10:00:00Z',
    memberCount: 3,
    userRole: 'owner',
  },
  {
    id: 'group-2',
    name: 'Viaje a Cartagena',
    description: 'Gastos del viaje de fin de semana',
    currency: 'COP',
    createdBy: 'demo-user-1',
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: '2024-02-10T10:00:00Z',
    memberCount: 4,
    userRole: 'member',
  },
];

const demoCategories: Category[] = [
  { id: 'cat-1', name: 'Comida', icon: 'utensils', color: '#14b8a6', isDefault: true },
  { id: 'cat-2', name: 'Transporte', icon: 'car', color: '#3b82f6', isDefault: true },
  { id: 'cat-3', name: 'Servicios', icon: 'zap', color: '#f59e0b', isDefault: true },
  { id: 'cat-4', name: 'Entretenimiento', icon: 'film', color: '#8b5cf6', isDefault: true },
  { id: 'cat-5', name: 'Compras', icon: 'shopping-bag', color: '#ec4899', isDefault: true },
  { id: 'cat-6', name: 'Otros', icon: 'more-horizontal', color: '#6b7280', isDefault: true },
];

const demoExpenses: Expense[] = [
  {
    id: 'exp-1',
    groupId: 'group-1',
    title: 'Supermercado semana',
    description: 'Compras del supermercado para la semana',
    amountMinor: 15000000, // 150.000 COP en unidades menores ISO
    currency: 'COP',
    settlementAmountMinor: 15000000,
    settlementCurrency: 'COP',
    paidBy: 'demo-user-1',
    paidByName: 'Usuario Demo',
    splitType: 'equal',
    splits: [
      { userId: 'demo-user-1', amountMinor: 5000000 },
      { userId: 'user-2', amountMinor: 5000000 },
      { userId: 'user-3', amountMinor: 5000000 },
    ],
    categoryId: 'cat-1',
    categoryName: 'Comida',
    categoryColor: '#14b8a6',
    date: '2024-01-20',
    createdAt: '2024-01-20T14:30:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
    settlementStatus: 'pending',
  },
  {
    id: 'exp-2',
    groupId: 'group-1',
    title: 'Factura de internet',
    amountMinor: 12000000, // 120.000 COP en unidades menores ISO
    currency: 'COP',
    settlementAmountMinor: 12000000,
    settlementCurrency: 'COP',
    paidBy: 'user-2',
    paidByName: 'María',
    paidByAvatar: undefined,
    splitType: 'equal',
    splits: [
      { userId: 'demo-user-1', amountMinor: 4000000 },
      { userId: 'user-2', amountMinor: 4000000 },
      { userId: 'user-3', amountMinor: 4000000 },
    ],
    categoryId: 'cat-3',
    categoryName: 'Servicios',
    categoryColor: '#f59e0b',
    date: '2024-01-18',
    createdAt: '2024-01-18T10:00:00Z',
    updatedAt: '2024-01-18T10:00:00Z',
    settlementStatus: 'pending',
  },
];

const demoSettlements: Settlement[] = [
  {
    id: 'set-1',
    groupId: 'group-1',
    fromUserId: 'demo-user-1',
    fromUserName: 'Usuario Demo',
    toUserId: 'user-2',
    toUserName: 'María',
    amountMinor: 4000000,
    currency: 'COP',
    status: 'declared',
    declaredAt: '2024-01-21T09:00:00Z',
    createdAt: '2024-01-21T09:00:00Z',
    updatedAt: '2024-01-21T09:00:00Z',
  },
];

// ============================================
// Demo Delay Helper
// ============================================

async function demoDelay(ms: number = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// API Client Class
// ============================================

class ApiClient {
  private config: ApiClientConfig;
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  private buildUrl(endpoint: string, params?: object): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const base = new URL(this.config.baseUrl, origin);
    const basePath = base.pathname.replace(/\/+$/, '');
    const endpointPath = endpoint.replace(/^\/+/, '');
    const url = new URL(`${basePath}/${endpointPath}`, base.origin);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }
    return url.toString();
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, signal, skipAuth, headers, idempotencyKey, ...fetchOptions } = options;
    const url = this.buildUrl(endpoint, params);
    const accessToken = this.config.getAccessToken();
    const requestHeaders = new Headers(headers);
    const method = (fetchOptions.method || 'GET').toUpperCase();

    // Avoid unnecessary CORS preflights: GET/DELETE without a body do not need
    // a JSON content type. Set it only for requests carrying a JSON body.
    if (fetchOptions.body !== undefined && !requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json');
    }

    if (accessToken && !skipAuth) {
      requestHeaders.set('Authorization', `Bearer ${accessToken}`);
    }

    // Every mutation gets an idempotency header. Offline operations pass their
    // persisted key explicitly so a retry reuses the same key.
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      requestHeaders.set('Idempotency-Key', idempotencyKey || createIdempotencyKey());
    }

    const controller = new AbortController();
    const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const requestKey = `${method}:${url}`;
    this.abortControllers.set(requestKey, controller);

    try {
      if (DEMO_MODE) {
        return await this.handleDemoRequest<T>(endpoint, { ...fetchOptions, params });
      }

      const response = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
        signal: requestSignal,
        credentials: 'include',
      });

      if (!response.ok) {
        let errorData: ApiError;
        try {
          errorData = await response.json();
        } catch {
          errorData = {
            code: 'UNKNOWN_ERROR',
            message: `Error ${response.status}: ${response.statusText}`,
            statusCode: response.status,
          };
        }

        if (response.status === 401) this.config.onUnauthorized();
        throw ApiRequestError.fromResponse(response, errorData);
      }

      if (response.status === 204) return undefined as T;
      return await response.json();
    } catch (error) {
      if (error instanceof ApiRequestError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Solicitud cancelada');
      }
      if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
        throw new ApiNetworkError();
      }
      throw error;
    } finally {
      this.abortControllers.delete(requestKey);
    }
  }

  // ============================================
  // Demo Request Handler
  // ============================================

  private async handleDemoRequest<T>(endpoint: string, options: RequestOptions): Promise<T> {
    await demoDelay();

    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body as string) : null;

    // Explicit no-account demo entry: this is handled locally, without a network request.
    if (endpoint === '/auth/demo' && method === 'POST') {
      demoAuthenticated = true;
      return {
        user: demoUser,
        accessToken: 'demo-token',
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      } as T;
    }

    // Auth endpoints
    if (endpoint === '/auth/register' && method === 'POST') {
      demoAuthenticated = true;
      return {
        user: demoUser,
        accessToken: 'demo-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      } as T;
    }

    if (endpoint === '/auth/login' && method === 'POST') {
      demoAuthenticated = true;
      return {
        user: demoUser,
        accessToken: 'demo-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      } as T;
    }

    if (endpoint === '/auth/me' && method === 'GET') {
      if (!demoAuthenticated) {
        throw new ApiRequestError(401, 'UNAUTHORIZED', 'Debes iniciar sesión');
      }
      return demoUser as T;
    }

    if (endpoint === '/auth/logout' && method === 'POST') {
      demoAuthenticated = false;
      return {} as T;
    }

    if (endpoint === '/auth/forgot-password' && method === 'POST') {
      return {} as T;
    }

    if (endpoint === '/auth/reset-password' && method === 'POST') {
      return {} as T;
    }

    if (endpoint === '/auth/change-password' && method === 'POST') {
      return {} as T;
    }

    // Groups
    if (endpoint === '/groups' && method === 'GET') {
      return {
        data: demoGroups,
        meta: { page: 1, limit: 20, total: demoGroups.length, totalPages: 1 },
      } as T;
    }

    if (endpoint.startsWith('/groups/') && method === 'GET' && !endpoint.includes('/members') && !endpoint.includes('/invitations')) {
      const id = endpoint.split('/')[2];
      const group = demoGroups.find(g => g.id === id);
      if (!group) throw new ApiRequestError(404, 'NOT_FOUND', 'Grupo no encontrado');
      return { ...group, members: [] } as T;
    }

    if (endpoint === '/groups' && method === 'POST') {
      const newGroup: Group = {
        id: `group-${Date.now()}`,
        ...body,
        currency: body.currency || 'COP',
        createdBy: demoUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        memberCount: 1,
        userRole: 'owner',
      };
      demoGroups.push(newGroup);
      return newGroup as T;
    }

    if (endpoint.startsWith('/groups/') && method === 'PATCH') {
      const id = endpoint.split('/')[2];
      const idx = demoGroups.findIndex(g => g.id === id);
      if (idx === -1) throw new ApiRequestError(404, 'NOT_FOUND', 'Grupo no encontrado');
      demoGroups[idx] = { ...demoGroups[idx], ...body, updatedAt: new Date().toISOString() };
      return demoGroups[idx] as T;
    }

    if (endpoint.startsWith('/groups/') && method === 'DELETE') {
      const id = endpoint.split('/')[2];
      const idx = demoGroups.findIndex(g => g.id === id);
      if (idx === -1) throw new ApiRequestError(404, 'NOT_FOUND', 'Grupo no encontrado');
      demoGroups.splice(idx, 1);
      return {} as T;
    }

    // Members
    if (endpoint.startsWith('/groups/') && endpoint.includes('/members') && method === 'GET') {
      const groupId = endpoint.split('/')[2];
      return [] as T; // Empty for demo
    }

    if (endpoint.startsWith('/groups/') && endpoint.includes('/members') && method === 'POST') {
      return { id: `member-${Date.now()}`, ...body, joinedAt: new Date().toISOString(), user: demoUser } as T;
    }

    // Invitations
    if (endpoint.startsWith('/groups/') && endpoint.includes('/invitations') && method === 'POST') {
      return {
        id: `inv-${Date.now()}`,
        groupId: endpoint.split('/')[2],
        groupName: 'Grupo Demo',
        invitedBy: demoUser.id,
        invitedByName: demoUser.name,
        email: body.email,
        role: body.role || 'member',
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      } as T;
    }

    if (endpoint === '/invitations/accept' && method === 'POST') {
      return demoGroups[0] as T;
    }

    // Expenses
    if (endpoint === '/expenses' && method === 'GET') {
      const params = options.params as ExpenseFilters | undefined;
      let filtered = [...demoExpenses];
      if (params?.groupId) filtered = filtered.filter(e => e.groupId === params.groupId);
      return {
        data: filtered,
        meta: { page: 1, limit: 20, total: filtered.length, totalPages: 1 },
      } as T;
    }

    if (endpoint.startsWith('/expenses/') && method === 'GET') {
      const id = endpoint.split('/')[2];
      const exp = demoExpenses.find(e => e.id === id);
      if (!exp) throw new ApiRequestError(404, 'NOT_FOUND', 'Gasto no encontrado');
      return exp as T;
    }

    if (endpoint === '/expenses' && method === 'POST') {
      const newExpense: Expense = {
        id: `exp-${Date.now()}`,
        ...body,
        paidByName: demoUser.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settlementStatus: 'pending',
      };
      demoExpenses.push(newExpense);
      return newExpense as T;
    }

    if (endpoint.startsWith('/expenses/') && method === 'PATCH') {
      const id = endpoint.split('/')[2];
      const idx = demoExpenses.findIndex(e => e.id === id);
      if (idx === -1) throw new ApiRequestError(404, 'NOT_FOUND', 'Gasto no encontrado');
      demoExpenses[idx] = { ...demoExpenses[idx], ...body, updatedAt: new Date().toISOString() };
      return demoExpenses[idx] as T;
    }

    if (endpoint.startsWith('/expenses/') && method === 'DELETE') {
      const id = endpoint.split('/')[2];
      const idx = demoExpenses.findIndex(e => e.id === id);
      if (idx === -1) throw new ApiRequestError(404, 'NOT_FOUND', 'Gasto no encontrado');
      demoExpenses.splice(idx, 1);
      return {} as T;
    }

    // Categories
    if (endpoint === '/categories' && method === 'GET') {
      return demoCategories as T;
    }

    // Balances
    if (endpoint.startsWith('/groups/') && endpoint.includes('/balances') && method === 'GET') {
      const groupId = endpoint.split('/')[2];
      return {
        groupId,
        groupName: 'Grupo Demo',
        currency: 'COP',
        balances: [
          { userId: 'demo-user-1', userName: 'Usuario Demo', balanceMinor: 1000000 },
          { userId: 'user-2', userName: 'María', balanceMinor: -500000 },
          { userId: 'user-3', userName: 'Carlos', balanceMinor: -500000 },
        ],
        totalExpensesMinor: 27000000,
        userBalance: { userId: 'demo-user-1', userName: 'Usuario Demo', balanceMinor: 1000000 },
      } as T;
    }

    if (endpoint.startsWith('/groups/') && endpoint.includes('/balances/detail') && method === 'GET') {
      return [
        {
          fromUserId: 'demo-user-1',
          fromUserName: 'Usuario Demo',
          toUserId: 'user-2',
          toUserName: 'María',
          amountMinor: 4000000,
          expenses: demoExpenses.filter(e => e.groupId === 'group-1'),
        },
      ] as T;
    }

    // Settlements
    if (endpoint === '/settlements' && method === 'GET') {
      return {
        data: demoSettlements,
        meta: { page: 1, limit: 20, total: demoSettlements.length, totalPages: 1 },
      } as T;
    }

    if (endpoint === '/settlements' && method === 'POST') {
      const newSettlement: Settlement = {
        id: `set-${Date.now()}`,
        ...body,
        fromUserId: demoUser.id,
        fromUserName: demoUser.name,
        status: 'declared',
        declaredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      demoSettlements.push(newSettlement);
      return newSettlement as T;
    }

    if (endpoint.startsWith('/settlements/') && endpoint.includes('/confirm') && method === 'POST') {
      const id = endpoint.split('/')[2];
      const idx = demoSettlements.findIndex(s => s.id === id);
      if (idx === -1) throw new ApiRequestError(404, 'NOT_FOUND', 'Liquidación no encontrada');
      demoSettlements[idx] = { ...demoSettlements[idx], status: 'confirmed', confirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      return demoSettlements[idx] as T;
    }

    if (endpoint.startsWith('/settlements/') && endpoint.includes('/dispute') && method === 'POST') {
      const id = endpoint.split('/')[2];
      const idx = demoSettlements.findIndex(s => s.id === id);
      if (idx === -1) throw new ApiRequestError(404, 'NOT_FOUND', 'Liquidación no encontrada');
      demoSettlements[idx] = { ...demoSettlements[idx], status: 'disputed', disputedAt: new Date().toISOString(), disputeReason: body.reason, updatedAt: new Date().toISOString() };
      return demoSettlements[idx] as T;
    }

    // Health
    if (endpoint === '/health' && method === 'GET') {
      return {
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: { database: 'ok', cache: 'ok' },
      } as T;
    }

    throw new ApiRequestError(404, 'NOT_FOUND', `Endpoint no implementado en modo demo: ${method} ${endpoint}`);
  }

  // ============================================
  // Public API Methods
  // ============================================

  // Auth
  async startDemoSession(): Promise<Session> {
    // Deliberately opt-in: all requests in this page lifetime use local demo fixtures.
    DEMO_MODE = true;
    demoAuthenticated = false;
    return this.request<Session>('/auth/demo', { method: 'POST', body: JSON.stringify({}), skipAuth: true });
  }

  async register(data: RegisterRequest): Promise<Session> {
    return this.request<Session>('/auth/register', { method: 'POST', body: JSON.stringify(data), skipAuth: true });
  }

  async login(data: LoginRequest): Promise<Session> {
    return this.request<Session>('/auth/login', { method: 'POST', body: JSON.stringify(data), skipAuth: true });
  }

  async logout(): Promise<void> {
    return this.request<void>('/auth/logout', { method: 'POST' });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<void> {
    return this.request<void>('/auth/forgot-password', { method: 'POST', body: JSON.stringify(data), skipAuth: true });
  }

  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    return this.request<void>('/auth/reset-password', { method: 'POST', body: JSON.stringify(data), skipAuth: true });
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    return this.request<void>('/auth/change-password', { method: 'POST', body: JSON.stringify(data) });
  }

  // Groups
  async getGroups(params?: PaginationParams): Promise<PaginatedResponse<Group>> {
    return this.request<PaginatedResponse<Group>>('/groups', { params });
  }

  async getGroup(id: string): Promise<Group> {
    return this.request<Group>(`/groups/${id}`);
  }

  async createGroup(data: CreateGroupRequest): Promise<Group> {
    return this.request<Group>('/groups', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateGroup(id: string, data: UpdateGroupRequest): Promise<Group> {
    return this.request<Group>(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteGroup(id: string): Promise<void> {
    return this.request<void>(`/groups/${id}`, { method: 'DELETE' });
  }

  async getGroupMembers(groupId: string, params?: PaginationParams): Promise<PaginatedResponse<GroupMember>> {
    return this.request<PaginatedResponse<GroupMember>>(`/groups/${groupId}/members`, { params });
  }

  async inviteMember(groupId: string, data: InviteMemberRequest): Promise<Invitation> {
    return this.request<Invitation>(`/groups/${groupId}/invitations`, { method: 'POST', body: JSON.stringify(data) });
  }

  async getGroupInvitations(groupId: string): Promise<Invitation[]> {
    return this.request<Invitation[]>(`/groups/${groupId}/invitations`);
  }

  async revokeInvitation(groupId: string, invitationId: string): Promise<void> {
    return this.request<void>(`/groups/${groupId}/invitations/${invitationId}`, { method: 'DELETE' });
  }

  async acceptInvitation(data: AcceptInvitationRequest): Promise<Group> {
    return this.request<Group>('/invitations/accept', { method: 'POST', body: JSON.stringify(data) });
  }

  async removeMember(groupId: string, memberId: string): Promise<void> {
    return this.request<void>(`/groups/${groupId}/members/${memberId}`, { method: 'DELETE' });
  }

  async updateMemberRole(groupId: string, memberId: string, role: MemberRole): Promise<GroupMember> {
    return this.request<GroupMember>(`/groups/${groupId}/members/${memberId}`, { method: 'PATCH', body: JSON.stringify({ role }) });
  }

  // Expenses
  async getExpenses(params?: ExpenseFilters): Promise<PaginatedResponse<Expense>> {
    return this.request<PaginatedResponse<Expense>>('/expenses', { params });
  }

  async getExpense(id: string): Promise<Expense> {
    return this.request<Expense>(`/expenses/${id}`);
  }

  async createExpense(data: CreateExpenseRequest): Promise<Expense> {
    const { idempotencyKey, ...payload } = data;
    return this.request<Expense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
      idempotencyKey,
    });
  }

  async updateExpense(id: string, data: UpdateExpenseRequest, idempotencyKey?: string): Promise<Expense> {
    return this.request<Expense>(`/expenses/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      idempotencyKey,
    });
  }

  async deleteExpense(id: string, idempotencyKey?: string): Promise<void> {
    return this.request<void>(`/expenses/${encodeURIComponent(id)}`, { method: 'DELETE', idempotencyKey });
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/categories');
  }

  // Balances
  async getGroupBalance(groupId: string): Promise<GroupBalance> {
    return this.request<GroupBalance>(`/groups/${groupId}/balances`);
  }

  async getBalanceDetail(groupId: string): Promise<BalanceDetail[]> {
    return this.request<BalanceDetail[]>(`/groups/${groupId}/balances/detail`);
  }

  // Settlements
  async getSettlements(params?: PaginationParams & { groupId?: string }): Promise<PaginatedResponse<Settlement>> {
    return this.request<PaginatedResponse<Settlement>>('/settlements', { params });
  }

  async createSettlement(data: CreateSettlementRequest): Promise<Settlement> {
    const { idempotencyKey, ...payload } = data;
    return this.request<Settlement>('/settlements', {
      method: 'POST',
      body: JSON.stringify(payload),
      idempotencyKey,
    });
  }

  async confirmSettlement(settlementId: string): Promise<Settlement> {
    return this.request<Settlement>(`/settlements/${settlementId}/confirm`, { method: 'POST' });
  }

  async disputeSettlement(settlementId: string, reason: string): Promise<Settlement> {
    return this.request<Settlement>(`/settlements/${settlementId}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  // Health
  async healthCheck(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>('/health', { skipAuth: true });
  }

  // Cancellation
  cancelRequest(key: string): void {
    const controller = this.abortControllers.get(key);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(key);
    }
  }

  cancelAllRequests(): void {
    this.abortControllers.forEach((controller) => controller.abort());
    this.abortControllers.clear();
  }
}

// ============================================
// Singleton Instance
// ============================================

let apiClientInstance: ApiClient | null = null;

export function createApiClient(config: ApiClientConfig): ApiClient {
  apiClientInstance = new ApiClient(config);
  return apiClientInstance;
}

export function getApiClient(): ApiClient {
  // The default client is initialized lazily so hooks can use it without an
  // undocumented bootstrap call. Tests may still replace it via createApiClient.
  if (!apiClientInstance) {
    apiClientInstance = new ApiClient({
      baseUrl: API_BASE_URL,
      getAccessToken: () => inMemoryAccessToken,
      onUnauthorized: notifyUnauthorized,
    });
  }
  return apiClientInstance;
}

export function isDemoMode(): boolean {
  return DEMO_MODE;
}