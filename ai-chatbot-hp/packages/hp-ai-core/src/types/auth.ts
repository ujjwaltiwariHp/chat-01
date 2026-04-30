export type AuthMode = 'GATEWAY' | 'WIDGET' | 'STANDALONE' | 'INTERNAL';

/**
 * Common Auth Result Structure
 */
export interface AuthResult {
  mode: AuthMode;
  tenantId?: string;
  role?: string; 
  customerId?: string;
  externalId?: string;
  clientId?: string;
  sessionId?: string;
}

/**
 * Token Payload for JWTs
 */
export interface AuthTokenPayload {
  tid?: string; // Tenant ID
  rid?: string; // Role ID / Role Name
  cid?: string; // Customer ID
  eid?: string; // External/Widget ID
  iat?: number;
  exp?: number;
}
