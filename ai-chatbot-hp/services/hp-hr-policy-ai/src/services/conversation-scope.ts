export type ConversationScopeInput = {
  sessionId: string;
  tenantId: string;
  source?: string | null;
  customerId?: string | null;
  userId?: string | null;
};

export type ConversationScope = {
  sessionId: string;
  tenantId: string;
  source: string;
  customerId: string | null;
  userId: string | null;
};

const normalizeOptionalString = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export const normalizeConversationScope = (scope: ConversationScopeInput): ConversationScope => ({
  sessionId: scope.sessionId.trim(),
  tenantId: scope.tenantId.trim(),
  source: normalizeOptionalString(scope.source)?.toLowerCase() ?? 'standalone',
  customerId: normalizeOptionalString(scope.customerId),
  userId: normalizeOptionalString(scope.userId),
});

export const getConversationScopeSignature = (scope: ConversationScopeInput): string => {
  const normalized = normalizeConversationScope(scope);

  return [
    normalized.tenantId,
    normalized.sessionId,
    normalized.source,
    normalized.customerId ?? '-',
    normalized.userId ?? '-',
  ].join(':');
};
