import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { db } from '@/db/connection.js';
import { widgetCustomers } from '@/db/schema.js';
import { eq } from 'drizzle-orm';
import { ApiError, logger } from '@hp-intelligence/core';
import crypto from 'crypto';

/**
 * Validates API Keys and Domain Origin.
 * Can be used as a preHandler hook.
 */
export const widgetSecurityHook = async (request: FastifyRequest, reply: FastifyReply) => {
  const authHeader = request.headers.authorization;
  const origin = request.headers.origin as string;
  const referer = request.headers.referer as string;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError('AUTH_MISSING', 'Authorization Bearer token is required');
  }

  const apiKey = authHeader.split(' ')[1];

  try {
    // 1. Validate API Key (P4-01)
    // Hash incoming key to SHA-256 for comparison with stored hashes
    const hashedApiKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    const [customer] = await db
      .select()
      .from(widgetCustomers)
      .where(eq(widgetCustomers.apiKey, hashedApiKey))
      .limit(1);

    if (!customer) {
      throw new ApiError('AUTH_INVALID', 'Invalid API key');
    }

    if (!customer.enabled) {
      throw new ApiError('AUTH_INVALID', 'Widget is currently disabled for this customer');
    }

    // 2. Domain Whitelist Check (P4-02)
    const rawOrigin = (origin || referer || '').toLowerCase();

    /**
     * Proper domain matching: exact hostname or subdomain match.
     * Prevents bypass via substring (e.g., 'evil-example.com' matching 'example.com').
     */
    const isDomainWhitelisted = customer.allowedDomains.some((domain: string) => {
      if (domain === '*') return true;
      try {
        const hostname = new URL(rawOrigin).hostname;
        const normalizedDomain = domain.toLowerCase().replace(/^\./, '');
        return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
      } catch {
        // If URL parsing fails (no protocol, etc.), try direct hostname match
        const cleaned = rawOrigin.replace(/^https?:\/\//, '').split(/[:/]/)[0];
        const normalizedDomain = domain.toLowerCase().replace(/^\./, '');
        return cleaned === normalizedDomain || cleaned.endsWith(`.${normalizedDomain}`);
      }
    });

    if (!isDomainWhitelisted && customer.allowedDomains.length > 0) {
      logger.warn({ ns: 'security:domain', origin, referer, customerId: customer.id }, 'Blocked domain access');
      throw new ApiError('AUTH_DOMAIN_NOT_AUTHORIZED', 'Domain access denied (not whitelisted)');
    }

    logger.debug({ ns: 'security:auth', customerId: customer.id }, 'Customer identified and context established');
    // Establish context for downstream consumption
    (request as any).customerId = customer.id;
    (request as any).tenantId = customer.id;
    (request as any).customer = customer;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    logger.error({ ns: 'security:auth', error: err.message }, 'Failed to validate widget security');
    throw new ApiError('AUTH_INVALID', 'Security validation failed');
  }
};

/**
 * Fastify Plugin Wrapper for Widget Security
 */
const widgetSecurityModule: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', widgetSecurityHook);
};

export const widgetSecurityPlugin = fp(widgetSecurityModule);
