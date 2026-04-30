import { FastifyRequest } from 'fastify';
import { AuthError } from '../utils/api-error.js';
import { AuthResult } from '../types/auth.js';
import { CoreErrorCode } from '../errors/error-codes.js';
import { config } from '../config/base-config.js';
import { safeCompare } from '../utils/safe-compare.js';

/**
 * Validates Widget-Service proxy tokens and extracts Customer context.
 */
export const validateWidgetToken = async (request: FastifyRequest): Promise<AuthResult> => {
  const serviceToken = request.headers['x-service-token'] as string;
  const customerId = request.headers['x-customer-id'] as string;
  const tenantId = request.headers['x-tenant-id'] as string;
  const { WIDGET_SERVICE_SECRET } = config;

  if (!serviceToken || !safeCompare(serviceToken, WIDGET_SERVICE_SECRET)) {
    throw new AuthError('Missing or invalid widget service token', CoreErrorCode.AUTH_INVALID);
  }

  if (!customerId) {
    throw new AuthError('Missing X-Customer-ID header from widget service', CoreErrorCode.AUTH_MISSING);
  }

  if (!tenantId) {
    throw new AuthError('Missing X-Tenant-ID header from widget service', CoreErrorCode.AUTH_MISSING);
  }

  return {
    mode: 'WIDGET',
    tenantId,
    customerId,
  };
};
