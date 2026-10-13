import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, 'Usa un código de moneda ISO 4217 en mayúsculas');
export const minorAmountSchema = z.number().int().safe().nonnegative();
export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const memberRoleSchema = z.enum(['owner', 'admin', 'member']);
export const splitTypeSchema = z.enum(['equal', 'custom', 'percentage']);
export const settlementStatusSchema = z.enum(['pending', 'declared', 'confirmed', 'disputed', 'cancelled']);
export const permissionSchema = z.enum([
  'group:read', 'group:update', 'group:archive', 'members:read', 'members:manage',
  'invitations:manage', 'expenses:create', 'expenses:update_own', 'expenses:update_any',
  'expenses:delete_own', 'expenses:delete_any', 'settlements:create', 'settlements:confirm',
  'settlements:dispute', 'receipts:manage', 'reports:export', 'permissions:manage',
  'categories:manage',
]);

export const registerSchema = z.object({
  email: z.string().trim().email('Ingresa un correo electrónico válido').max(254, 'El correo no puede superar 254 caracteres'),
  password: z.string().min(12, 'La contraseña debe tener al menos 12 caracteres').max(128, 'La contraseña no puede superar 128 caracteres'),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80, 'El nombre no puede superar 80 caracteres'),
});
export const loginSchema = z.object({ email: z.string().trim().email('Ingresa un correo electrónico válido').max(254), password: z.string().min(1, 'La contraseña es obligatoria').max(128), rememberMe: z.boolean().optional().default(false) });
export const forgotPasswordSchema = z.object({ email: z.string().trim().email('Ingresa un correo electrónico válido').max(254) });
export const resetPasswordSchema = z.object({ token: z.string().min(32).max(512), password: z.string().min(12, 'La nueva contraseña debe tener al menos 12 caracteres').max(128, 'La contraseña no puede superar 128 caracteres') });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12, 'La nueva contraseña debe tener al menos 12 caracteres').max(128, 'La contraseña no puede superar 128 caracteres') });

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  currency: currencyCodeSchema.default('COP'),
  locale: z.string().trim().min(2).max(20).default('es-CO'),
  timezone: z.string().trim().min(1).max(80).default('America/Bogota'),
});
export const updateGroupSchema = createGroupSchema.partial().refine(v => Object.keys(v).length > 0, 'Envía al menos un campo');
export const createInvitationSchema = z.object({ email: z.string().trim().email().max(254).optional(), role: z.enum(['admin', 'member']).default('member'), expiresInDays: z.number().int().min(1).max(30).default(7) });
export const acceptInvitationSchema = z.object({ token: z.string().min(32).max(512) });
export const updateMemberRoleSchema = z.object({ role: z.enum(['admin', 'member']) });
export const transferOwnershipSchema = z.object({ newOwnerUserId: uuidSchema });
export const fxQuoteQuerySchema = z.object({ from: currencyCodeSchema, to: currencyCodeSchema, manualRate: z.string().regex(/^\d{1,12}(\.\d{1,12})?$/).optional() });
export const updatePermissionsSchema = z.object({ role: z.enum(['admin', 'member']), permissions: z.array(permissionSchema).max(18) });

export const splitInputSchema = z.object({
  userId: uuidSchema,
  amountMinor: minorAmountSchema.optional(),
  percentage: z.number().min(0).max(100).optional(),
});
export const createExpenseSchema = z.object({
  groupId: uuidSchema,
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  amountMinor: minorAmountSchema.refine(v => v > 0, 'El importe debe ser mayor que cero'),
  currency: currencyCodeSchema.optional(),
  paidBy: uuidSchema,
  splitType: splitTypeSchema,
  splits: z.array(splitInputSchema).min(1).max(100),
  categoryId: uuidSchema.optional(),
  date: dateOnlySchema,
  fxRate: z.string().regex(/^\d{1,12}(\.\d{1,12})?$/).optional(),
}).superRefine((v, ctx) => {
  if (new Set(v.splits.map(s => s.userId)).size !== v.splits.length) ctx.addIssue({ code: 'custom', path: ['splits'], message: 'No repitas participantes' });
  if (v.splitType === 'custom' && v.splits.some(s => s.amountMinor === undefined)) ctx.addIssue({ code: 'custom', path: ['splits'], message: 'Cada participación personalizada requiere amountMinor' });
  if (v.splitType === 'percentage' && v.splits.some(s => s.percentage === undefined)) ctx.addIssue({ code: 'custom', path: ['splits'], message: 'Cada participación porcentual requiere percentage' });
  if (v.splitType !== 'custom' && v.splits.some(s => s.amountMinor !== undefined)) ctx.addIssue({ code: 'custom', path: ['splits'], message: 'amountMinor solo se acepta en reparto custom' });
  if (v.splitType !== 'percentage' && v.splits.some(s => s.percentage !== undefined)) ctx.addIssue({ code: 'custom', path: ['splits'], message: 'percentage solo se acepta en reparto percentage' });
});
export const updateExpenseSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(), description: z.string().trim().max(2000).nullable().optional(),
  amountMinor: minorAmountSchema.refine(v => v > 0).optional(), currency: currencyCodeSchema.optional(),
  splitType: splitTypeSchema.optional(), splits: z.array(splitInputSchema).min(1).max(100).optional(),
  categoryId: uuidSchema.nullable().optional(), date: dateOnlySchema.optional(), fxRate: z.string().regex(/^\d{1,12}(\.\d{1,12})?$/).optional(),
}).refine(v => Object.keys(v).length > 0, 'Envía al menos un campo');
export const createSettlementSchema = z.object({ groupId: uuidSchema, toUserId: uuidSchema, amountMinor: minorAmountSchema.refine(v => v > 0) });
export const disputeSettlementSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const createCategorySchema = z.object({ name: z.string().trim().min(1).max(60), icon: z.string().trim().max(40).default('circle'), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#64748b') });
export const createCategoryQuerySchema = z.object({ groupId: uuidSchema.optional() });
export const exportQuerySchema = z.object({ format: z.enum(['csv', 'pdf']).default('csv'), from: dateOnlySchema.optional(), to: dateOnlySchema.optional() }).refine(v => !v.from || !v.to || v.from <= v.to, 'La fecha inicial debe ser anterior a la final');

export type Id = string;
export type ApiError = { code: string; message: string; details?: Record<string, string[]>; statusCode: number; requestId?: string };
export type PaginationParams = { page?: number; limit?: number };
export type PaginatedResponse<T> = { data: T[]; meta: { page: number; limit: number; total: number; totalPages: number } };
export type User = { id: Id; email: string; name: string; avatarUrl?: string | null; createdAt: string; updatedAt: string };
export type Session = { user: User; accessToken: string; expiresAt: string };
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.input<typeof loginSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
export type GroupPermission = z.infer<typeof permissionSchema>;
export type GroupMember = { id: Id; userId: Id; groupId: Id; role: MemberRole; joinedAt: string; user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>; permissions?: GroupPermission[] };
export type Group = { id: Id; name: string; description?: string | null; avatarUrl?: string | null; currency: string; createdBy: Id; createdAt: string; updatedAt: string; memberCount: number; members?: GroupMember[]; userRole?: MemberRole; locale?: string; timezone?: string };
export type CreateGroupRequest = z.input<typeof createGroupSchema>;
export type UpdateGroupRequest = z.infer<typeof updateGroupSchema>;
export type InviteMemberRequest = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationSchema>;
export type Invitation = { id: Id; groupId: Id; groupName: string; invitedBy: Id; invitedByName: string; email?: string | null; role: MemberRole; status: 'pending' | 'accepted' | 'expired' | 'revoked'; expiresAt: string; createdAt: string; invitationUrl?: string };
export type SplitType = z.infer<typeof splitTypeSchema>;
export type ExpenseSplit = { userId: Id; amountMinor: number; settlementAmountMinor?: number; percentage?: number };
export type SplitInput = z.infer<typeof splitInputSchema>;
export type Expense = { id: Id; groupId: Id; title: string; description?: string | null; amountMinor: number; currency: string; settlementAmountMinor: number; settlementCurrency: string; fxRate?: string | null; fxSource?: string | null; fxAsOf?: string | null; paidBy: Id; paidByName: string; paidByAvatar?: string | null; splitType: SplitType; splits: ExpenseSplit[]; categoryId?: Id | null; categoryName?: string | null; categoryColor?: string | null; date: string; createdAt: string; updatedAt: string; settlementStatus: 'pending' | 'partial' | 'settled'; archivedAt?: string | null };
export type CreateExpenseRequest = Omit<z.infer<typeof createExpenseSchema>, 'splits'> & { splits: SplitInput[]; idempotencyKey: string };
export type UpdateExpenseRequest = z.infer<typeof updateExpenseSchema>;
export type ExpenseFilters = PaginationParams & { groupId?: Id; categoryId?: Id; paidBy?: Id; dateFrom?: string; dateTo?: string; amountMin?: number; amountMax?: number; search?: string };
export type Category = { id: Id; name: string; icon: string; color: string; isDefault: boolean; groupId?: Id | null };
export type UserBalance = { userId: Id; userName: string; userAvatar?: string | null; balanceMinor: number };
export type GroupBalance = { groupId: Id; groupName: string; currency: string; balances: UserBalance[]; totalExpensesMinor: number; userBalance: UserBalance };
export type BalanceDetail = { fromUserId: Id; fromUserName: string; fromUserAvatar?: string | null; toUserId: Id; toUserName: string; toUserAvatar?: string | null; amountMinor: number; expenses: Pick<Expense, 'id' | 'title' | 'date' | 'amountMinor'>[] };
export type SettlementStatus = z.infer<typeof settlementStatusSchema>;
export type Settlement = { id: Id; groupId: Id; fromUserId: Id; fromUserName: string; fromUserAvatar?: string | null; toUserId: Id; toUserName: string; toUserAvatar?: string | null; amountMinor: number; currency: string; status: SettlementStatus; declaredAt?: string | null; confirmedAt?: string | null; disputedAt?: string | null; disputeReason?: string | null; createdAt: string; updatedAt: string };
export type CreateSettlementRequest = z.infer<typeof createSettlementSchema> & { idempotencyKey: string };
export type ConfirmSettlementRequest = { settlementId: Id };
export type DisputeSettlementRequest = z.infer<typeof disputeSettlementSchema> & { settlementId: Id };
export type HealthCheckResponse = { status: 'ok' | 'degraded' | 'down'; version: string; timestamp: string; services: { database: 'ok' | 'down'; cache: 'ok' | 'down' } };
