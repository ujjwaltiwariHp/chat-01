import { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AuthError } from '../utils/api-error.js';
import { AuthResult } from '../types/auth.js';
import { CoreErrorCode } from '../errors/error-codes.js';
import { config } from '../config/base-config.js';

const StandaloneJwtSchema = z
  .looseObject({
    sub: z.string().optional(),
    id: z.string().optional(),
    tid: z.string().optional(),    // Tenant ID
    cid: z.string().optional(),    // Customer ID
    iat: z.number().optional(),
    exp: z.number().optional(),
  })
  .refine((data) => data.id || data.sub, {
    message: "Token must contain either 'id' or 'sub' claim",
  })
  .refine((data) => !!data.tid, {
    message: "Token must contain 'tid' claim",
  });

/**
 * Validates Standalone API keys (Bearer JWTs) directly.
 * Verifies signature with INTERNAL_SERVICE_TOKEN and validates payload schema.
 */
export const validateStandaloneApiKey = async (request: FastifyRequest): Promise<AuthResult> => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header (Bearer format)', CoreErrorCode.AUTH_MISSING);
  }

  const token = authHeader.split(' ')[1];

  if (!token || token === 'undefined') {
    throw new AuthError('Invalid API key', CoreErrorCode.AUTH_INVALID);
  }

  try {
    const rawDecoded = jwt.verify(token, config.INTERNAL_SERVICE_TOKEN, {
      algorithms: ['HS256'],
    });

    const result = StandaloneJwtSchema.safeParse(rawDecoded);

    if (!result.success) {
      throw new AuthError('Invalid token payload structure', CoreErrorCode.AUTH_INVALID);
    }

    const payload = result.data;

    return {
      mode: 'STANDALONE',
      tenantId: payload.tid,
      customerId: payload.cid,
      externalId: (payload.id || payload.sub)!,
    };
  } catch (err: any) {
    if (err instanceof AuthError) throw err;

    // jwt.verify throws specific errors for expired/malformed tokens
    if (err.name === 'TokenExpiredError') {
      throw new AuthError('Token has expired', CoreErrorCode.AUTH_INVALID);
    }
    if (err.name === 'JsonWebTokenError') {
      throw new AuthError('Invalid token signature', CoreErrorCode.AUTH_INVALID);
    }

    throw new AuthError('Token verification failed', CoreErrorCode.AUTH_INVALID);
  }
};
