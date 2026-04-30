import { ErrorCodes, logger, redis } from '@hp-intelligence/core';

const sessionLogger = logger.child({ ns: 'hr-policy:session' });
const SESSION_PREFIX = 'session:';
const SESSION_TTL = 3600 * 24;

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
    await redis.setex(key, SESSION_TTL, JSON.stringify(data));
    sessionLogger.debug({ sessionId: hashedSessionId, ttl: SESSION_TTL }, 'session.created');
  } catch (error: any) {
    sessionLogger.error({
      error: error.message,
      code: ErrorCodes.SESSION_CREATE_FAILED,
    }, 'session.create.failed');
    throw error;
  }
}

export async function validateAndRefreshSession(hashedSessionId: string): Promise<SessionData | null> {
  const key = `${SESSION_PREFIX}${hashedSessionId}`;

  try {
    const raw = await redis.get(key);
    if (!raw) {
      return null;
    }

    await redis.expire(key, SESSION_TTL);
    return JSON.parse(raw) as SessionData;
  } catch (error: any) {
    sessionLogger.error({
      error: error.message,
      code: ErrorCodes.SESSION_VALIDATE_FAILED,
    }, 'session.validate.failed');
    throw error;
  }
}

export function getSessionTTLMs(): number {
  return SESSION_TTL * 1000;
}
