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
  userId: string; // Internal unified ID
};

const normalizeOptionalString = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export const normalizeConversationScope = (scope: ConversationScopeInput): ConversationScope => {
  const sessionId = scope.sessionId.trim();
  const tenantId = scope.tenantId.trim();
  const source = normalizeOptionalString(scope.source)?.toLowerCase() ?? 'standalone';
  
  // Consolidate: Priority 1: userId, Priority 2: customerId, Fallback: anonymous
  const userId = normalizeOptionalString(scope.userId) || 
                 normalizeOptionalString(scope.customerId) || 
                 'anonymous';

  return { sessionId, tenantId, source, userId };
};

export const getConversationScopeSignature = (scope: ConversationScopeInput): string => {
  const normalized = normalizeConversationScope(scope);

  return [
    normalized.tenantId,
    normalized.sessionId,
    normalized.source,
    normalized.userId,
  ].join(':');
};
