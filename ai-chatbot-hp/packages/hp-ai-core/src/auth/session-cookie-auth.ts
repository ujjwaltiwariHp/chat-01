import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { logger } from '../logging/logger.js';
import { AuthError } from '../utils/api-error.js';
import { hashSessionId } from '../utils/encryption.js';
import { HttpStatusCode } from '../utils/http-status.js';

export const SessionJwtPayloadSchema = z
  .looseObject({
    id: z.string().optional(),
    sub: z.string().optional(),
    iat: z.number(),
    exp: z.number(),
    tid: z.string().optional(),
  })
  .refine((data) => data.id || data.sub, {
    message: "Token must contain either 'id' or 'sub' claim",
  })
  .refine((data) => !!data.tid, {
    message: "Token must contain 'tid' claim",
  });

export type SessionJwtUserPayload = z.infer<typeof SessionJwtPayloadSchema>;

enum SessionSource {
  HEADER = 'header',
  QUERY = 'query',
  COOKIE = 'cookie',
  NEW = 'new',
}

type SessionStore = {
  createSession: (hashedSessionId: string, userId: string) => Promise<void>;
  validateAndRefreshSession: (hashedSessionId: string) => Promise<unknown>;
  getSessionTTLMs: () => number;
};

type CreateSessionCookieAuthHookOptions = {
  sessionSecret: string;
  jwtSecret: string;
  loggerNs: string;
  store: SessionStore;
};

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce((accumulator, cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    accumulator[name.trim()] = rest.join('=');
    return accumulator;
  }, {} as Record<string, string>);
};

const isHighEntropyId = (id: string): boolean => {
  // Enforce 64-character hex string OR standard UUID (36 chars)
  return /^[a-f0-9]{64}$/i.test(id) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

const resolveSessionId = (request: FastifyRequest): { plainSessionId: string; source: SessionSource } => {
  const sessionHeader = request.headers['x-session-id'] as string | undefined;
  const sessionQuery = (request.query as { sessionId?: string } | undefined)?.sessionId;
  const cookies = (request as any).cookies || parseCookies(request.headers.cookie);
  const sessionCookie = cookies?.chat_session_id;

  if (sessionHeader && isHighEntropyId(sessionHeader)) {
    return { plainSessionId: sessionHeader, source: SessionSource.HEADER };
  }
  if (sessionQuery && isHighEntropyId(sessionQuery)) {
    return { plainSessionId: sessionQuery, source: SessionSource.QUERY };
  }
  if (sessionCookie && isHighEntropyId(sessionCookie)) {
    return { plainSessionId: sessionCookie, source: SessionSource.COOKIE };
  }

  return {
    plainSessionId: crypto.randomBytes(32).toString('hex'),
    source: SessionSource.NEW,
  };
};

const generateCsrfToken = (plainSessionId: string, sessionSecret: string): string =>
  crypto.createHmac('sha256', sessionSecret).update(plainSessionId).digest('hex');

const setSessionCookie = (
  request: FastifyRequest,
  reply: FastifyReply,
  plainSessionId: string,
  sessionSecret: string,
  getSessionTTLMs: () => number,
): void => {
  const ttlSeconds = getSessionTTLMs() / 1000;
  const isSecure = request.protocol === 'https' || request.headers['x-forwarded-proto'] === 'https';
  const sameSite = isSecure ? 'None' : 'Lax';

  const sessionCookieString = [
    `chat_session_id=${plainSessionId}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${ttlSeconds}`,
    `SameSite=${sameSite}`,
    ...(isSecure ? ['Secure'] : []),
  ].join('; ');

  const csrfCookieString = [
    `csrf_token=${generateCsrfToken(plainSessionId, sessionSecret)}`,
    'Path=/',
    `Max-Age=${ttlSeconds}`,
    `SameSite=${sameSite}`,
    ...(isSecure ? ['Secure'] : []),
  ].join('; ');

  const currentHeaders = reply.raw.getHeader('Set-Cookie');
  const nextHeaders = [
    ...(Array.isArray(currentHeaders) ? currentHeaders.map(String) : currentHeaders ? [String(currentHeaders)] : []),
    sessionCookieString,
    csrfCookieString,
  ];

  reply.raw.setHeader('Set-Cookie', nextHeaders);
};

const validateCsrf = (
  request: FastifyRequest,
  plainSessionId: string,
  source: SessionSource,
  sessionSecret: string,
): void => {
  if (source === SessionSource.HEADER) {
    return;
  }

  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(request.method.toUpperCase())) {
    return;
  }

  const csrfHeader = request.headers['x-csrf-token'] as string | undefined;
  if (!csrfHeader) {
    throw new AuthError('Access denied: CSRF token is required for state-changing requests', 'AUTH_CSRF_MISSING');
  }

  const expectedToken = generateCsrfToken(plainSessionId, sessionSecret);
  if (csrfHeader.length !== expectedToken.length) {
    throw new AuthError('Access denied: Invalid CSRF token', 'AUTH_CSRF_INVALID');
  }

  const headerBuffer = Buffer.from(csrfHeader);
  const expectedBuffer = Buffer.from(expectedToken);
  if (!crypto.timingSafeEqual(headerBuffer, expectedBuffer)) {
    throw new AuthError('Access denied: Invalid CSRF token', 'AUTH_CSRF_INVALID');
  }
};

export const createSessionCookieAuthHook = ({
  sessionSecret,
  jwtSecret,
  loggerNs,
  store,
}: CreateSessionCookieAuthHookOptions) => {
  const authLogger = logger.child({ ns: loggerNs });

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { plainSessionId, source } = resolveSessionId(request);
    const isNew = source === SessionSource.NEW;
    const hashedSessionId = hashSessionId(plainSessionId);
    const shouldManageCookie = source !== SessionSource.HEADER;

    request.plainSessionId = plainSessionId;
    request.sessionId = hashedSessionId;
    request.isNewSession = isNew;

    reply.raw.setHeader('X-Session-ID', plainSessionId);

    if (request.authMode) {
      if (!request.userId) {
        request.userId = request.customerId;
      }

      const skipCsrf = request.authMode === 'GATEWAY' || request.authMode === 'INTERNAL';
      if (shouldManageCookie && !isNew && !skipCsrf) {
        validateCsrf(request, plainSessionId, source, sessionSecret);
      }

      if (isNew && request.userId) {
        await store.createSession(hashedSessionId, request.userId);
      } else if (!isNew) {
        await store.validateAndRefreshSession(hashedSessionId);
      }

      if (shouldManageCookie) {
        setSessionCookie(request, reply, plainSessionId, sessionSecret, store.getSessionTTLMs);
      }
      reply.raw.setHeader('X-Session-ID', plainSessionId);
      return;
    }

    const authHeader = request.headers.authorization;
    if (authHeader?.match(/^Bearer\s+/i)) {
      const token = authHeader.replace(/^Bearer\s+/i, '');

      try {
        const rawDecoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
        const result = SessionJwtPayloadSchema.safeParse(rawDecoded);
        if (!result.success) {
          throw new Error('Invalid token');
        }

        const payload = result.data as any;
        request.tenantId = payload.tid;
        request.authMode = 'STANDALONE';
        request.user = result.data;
        request.userId = (payload.id || payload.sub)!;

        await store.createSession(hashedSessionId, request.userId!);
        if (shouldManageCookie) {
          setSessionCookie(request, reply, plainSessionId, sessionSecret, store.getSessionTTLMs);
        }
        return;
      } catch (error: any) {
        authLogger.warn({ error: error.message }, 'Dashboard JWT validation failed');
      }
    }

    authLogger.info({ msg: 'Rejecting unauthenticated anonymous request' });
    return reply.status(HttpStatusCode.UNAUTHORIZED).send({
      success: false,
      message: 'Access denied: Valid lane identification or credentials required.',
      meta: { errorCode: 'AUTH_REQUIRED' },
    });
  };
};
