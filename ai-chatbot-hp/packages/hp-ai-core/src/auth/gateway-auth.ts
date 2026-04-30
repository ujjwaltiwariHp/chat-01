import { FastifyRequest } from 'fastify';
import { AuthError } from '../utils/api-error.js';
import { AuthResult } from '../types/auth.js';
import { CoreErrorCode } from '../errors/error-codes.js';
import { config } from '../config/base-config.js';
import { safeCompare } from '../utils/safe-compare.js';
import { users } from '../db/shared-schema.js'; // New: Database schema import
import { eq, and } from 'drizzle-orm';     // New: Drizzle utilities

/**
 * Validates Gateway-Proxy tokens and extracts Tenant context.
 * Standardized to allow both Gateway-specific secret and the shared Internal Service Token.
 */
export const validateGatewayToken = async (request: FastifyRequest): Promise<AuthResult> => {
  const serviceToken = request.headers['x-service-token'] as string;
  const tenantId = request.headers['x-tenant-id'] as string;
  const { GATEWAY_SERVICE_SECRET, INTERNAL_SERVICE_TOKEN } = config;

  let isValidToken = serviceToken && (
    safeCompare(serviceToken, GATEWAY_SERVICE_SECRET) || 
    safeCompare(serviceToken, INTERNAL_SERVICE_TOKEN)
  );

  // High Standard: Support dynamic token rotation check inside gateway-specific validator too
  if (!isValidToken && serviceToken && request.server.redis) {
    const isDynamicValid = await request.server.redis.sismember('hp:auth:internal_tokens', serviceToken);
    if (isDynamicValid) isValidToken = true;
  }

  if (!isValidToken) {
    throw new AuthError('Missing or invalid internal service token from gateway', CoreErrorCode.AUTH_INVALID);
  }

  if (!tenantId) {
    throw new AuthError('Missing X-Tenant-ID header from gateway', CoreErrorCode.AUTH_MISSING);
  }

  const customerId = request.headers['x-customer-id'] as string;
  let role = 'user'; // Default fallback role

  // Security Hardening: Fetch the AUTHORITATIVE role from the database instead of the header
  if (tenantId && customerId && request.server.db) {
    try {
      const userResult = await request.server.db
        .select({ role: users.role })
        .from(users)
        .where(
          and(
            eq(users.id, customerId as any), // Use as any to bypass UUID type-checking for now
            eq(users.tenantId, tenantId as any)
          )
        )
        .limit(1);

      if (userResult.length > 0) {
        role = userResult[0].role;
      }
    } catch (error) {
       // Graceful fallback to avoid breaking flow if DB is slow or user doesn't exist yet
       // but log it for internal auditing
       request.log.warn({ ns: 'auth:gateway', customerId, msg: 'DB Role lookup failed, falling back to default' });
    }
  }

  return {
    mode: 'GATEWAY',
    tenantId,
    role,
    customerId,
    sessionId: request.headers['x-session-id'] as string | undefined
  };
};

