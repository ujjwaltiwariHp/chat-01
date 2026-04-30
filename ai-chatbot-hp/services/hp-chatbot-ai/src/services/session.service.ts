import { redis, logger, ErrorCodes } from '@hp-intelligence/core';

const sessionLogger = logger.child({ ns: 'session:service' });
const SESSION_PREFIX = 'session:';
const SESSION_TTL = 3600 * 24; // Default to 24 hours

interface SessionData {
  userId: string;
  createdAt: string;
}

export async function createSession(hashedSessionId: string, userId: string): Promise<void> {
  const key = `${SESSION_PREFIX}${hashedSessionId}`;
  const data: SessionData = {
    userId,
    createdAt: new Date().toISOString(),
  };

  try {
    const ttl = SESSION_TTL;
    await redis.setex(key, ttl, JSON.stringify(data));
    sessionLogger.debug({ msg: 'New session created in Redis', sessionId: hashedSessionId, ttl }, 'session.created');
  } catch (err: any) {
    sessionLogger.error({ msg: 'Failed to create session in Redis', error: err.message, code: ErrorCodes.SESSION_CREATE_FAILED }, 'session.error');
    throw err;
  }
}

export async function validateAndRefreshSession(hashedSessionId: string): Promise<SessionData | null> {
  const key = `${SESSION_PREFIX}${hashedSessionId}`;

  try {
    const raw = await redis.get(key);

    if (!raw) {
      return null;
    }

    // Actually refresh the TTL (sliding expiration)
    await redis.expire(key, SESSION_TTL);

    return JSON.parse(raw) as SessionData;
  } catch (err: any) {
    sessionLogger.error({ msg: 'Failed to validate session in Redis', error: err.message, code: ErrorCodes.SESSION_VALIDATE_FAILED }, 'session.error');
    throw err;
  }
}

export async function destroySession(hashedSessionId: string): Promise<void> {
  const key = `${SESSION_PREFIX}${hashedSessionId}`;

  try {
    await redis.del(key);
    sessionLogger.debug({ msg: 'Session removed from Redis', sessionId: hashedSessionId }, 'session.destroyed');
  } catch (err: any) {
    sessionLogger.error({ msg: 'Failed to destroy session in Redis', error: err.message, code: ErrorCodes.SESSION_DESTROY_FAILED }, 'session.error');
  }
}

export function getSessionTTLMs(): number {
  return SESSION_TTL * 1000;
}
