import { redis } from '../utils/redis-client.js';
import { logger } from '../logging/logger.js';
import { CoreErrorCode } from '../errors/error-codes.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { ChatMessage } from '../types/llm.js';
import crypto from 'crypto';
import client from 'prom-client';

const cacheLogger = logger.child({ ns: 'cache:semantic' });

// Global cache metrics for core
export const cacheCounter = new client.Counter({
  name: 'hp_cache_hits_total',
  help: 'Cache hits and misses across services',
  labelNames: ['result', 'service'],
});

function normalizeMessage(message: string): string {
  return message
    .trim()
    .toLowerCase()
    .replace(/['"]+/g, '')    // Remove literal quotes
    .replace(/[.,!?;:]/g, '') // Remove basic punctuation
    .replace(/\s+/g, ' ');    // Collapse multiple spaces
}

function generateCacheKey(message: string, history: ChatMessage[]): string {
  // Slice history to only include the last 6 messages for the hash
  const stableHistory = history.slice(-6).map(m => ({
    role: m.role.toLowerCase(),
    content: m.content
  }));

  const hash = stableHistory.length > 0
    ? crypto.createHash('sha256').update(JSON.stringify(stableHistory)).digest('hex').substring(0, 8)
    : 'no-history';
  return `cache:${hash}:${normalizeMessage(message)}`;
}

export async function getCachedResponse(
  message: string, 
  history: ChatMessage[] = [],
  serviceName: string = 'unknown'
): Promise<string | null> {
  const key = generateCacheKey(message, history);
  cacheLogger.info({ key, msg: 'Attempting semantic cache lookup' }, 'cache.lookup');
  
  try {
    const value = await redis.get(key);

    if (value) {
      cacheLogger.info({ key, msg: 'Cache hit for message' }, 'cache.hit');
      cacheCounter.labels({ result: 'hit', service: serviceName }).inc();
      return decrypt(value) ?? value;
    } else {
      cacheLogger.info({ key, msg: 'Cache miss for message' }, 'cache.miss');
      cacheCounter.labels({ result: 'miss', service: serviceName }).inc();
    }

    return value;
  } catch (err: any) {
    cacheLogger.error({
      error: err.message,
      operation: 'get',
      key,
      code: CoreErrorCode.INTERNAL_SERVER_ERROR
    });
    return null;
  }
}

export async function setCachedResponse(
  message: string, 
  response: string, 
  history: ChatMessage[] = []
): Promise<void> {
  const key = generateCacheKey(message, history);
  try {
    const encryptedResponse = encrypt(response);
    await redis.setex(key, 86400, encryptedResponse); // 24hr TTL
  } catch (err: any) {
    cacheLogger.error({
      error: err.message,
      operation: 'setex',
      key,
      code: CoreErrorCode.INTERNAL_SERVER_ERROR
    });
  }
}
