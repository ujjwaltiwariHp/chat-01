import crypto from 'crypto';
import { config } from '../config/base-config.js';
import { createLogger } from '../logging/logger.js';

const encryptionLogger = createLogger('encryption');
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

/**
 * Key derivation for better security.
 * Instead of direct hex key usage, we derive separate keys for encryption and HMAC.
 */
const SECRET = config.INTERNAL_SERVICE_TOKEN;
const AES_SALT = Buffer.from('session-encryption-v1', 'utf-8');
const HMAC_SALT = Buffer.from('session-hmac-v1', 'utf-8');

// Derive keys once at module load
const AES_KEY = crypto.pbkdf2Sync(SECRET, AES_SALT, ITERATIONS, KEY_LENGTH, 'sha256');
const HMAC_KEY = crypto.pbkdf2Sync(SECRET, HMAC_SALT, ITERATIONS, KEY_LENGTH, 'sha256');

/**
 * Encrypts a string (e.g., sessionId) for secure transmission to the frontend.
 * Returns the IV and encrypted text in hex format, separated by a colon.
 */
export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, AES_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    encryptionLogger.error({ ns: 'security:encryption', error: (error as Error).message }, 'Encryption failed');
    throw error;
  }
}

/**
 * Decrypts a string (e.g., encrypted sessionId) received from the frontend.
 * Expects the format 'iv:encryptedText'.
 */
export function decrypt(encryptedData: string): string | null {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      return null;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, AES_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    encryptionLogger.warn({ ns: 'security:encryption', error: (error as Error).message }, 'Decryption failed for session ID');
    return null;
  }
}

/**
 * Hashes a session ID using HMAC with a separate derived key.
 */
export function hashSessionId(sessionId: string): string {
  return crypto
    .createHmac('sha256', HMAC_KEY)
    .update(sessionId)
    .digest('hex');
}

