import crypto from 'crypto';
import { config } from '../config/base-config.js';
import { createLogger } from '../logging/logger.js';

const securityLogger = createLogger('security');
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
// Ensure key is 32 bytes for aes-256-cbc
const SECRET = Buffer.from(config.WIDGET_SITE_KEY_SECRET || '', 'hex');

// Allow a 2-minute drift (120 seconds) between client and server time
const MAX_TIME_DRIFT_SECONDS = 120;

/**
 * Decrypts the site key received from the frontend.
 * Expects the format 'iv:encryptedText' where both are hex-encoded.
 */
export function decryptSiteKey(encryptedSiteKey: string): string | null {
    try {
        const parts = encryptedSiteKey.split(':');
        if (parts.length !== 2) {
            securityLogger.warn({ ns: 'security:site' }, 'Invalid site key format');
            return null;
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');

        if (iv.length !== IV_LENGTH) {
            securityLogger.warn({ ns: 'security:site' }, 'Invalid IV length');
            return null;
        }

        const decipher = crypto.createDecipheriv(ALGORITHM, SECRET, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
    } catch (error) {
        securityLogger.error({ ns: 'security:site', error: (error as Error).message }, 'Decryption failed');
        return null;
    }
}

/**
 * Utility function to validate the decrypted site key.
 * Now expects the decrypted key to be in the format "KEY:TIMESTAMP"
 */
export function validateSiteKey(decryptedPayload: string | null): boolean {
    if (!decryptedPayload) return false;

    try {
        const parts = decryptedPayload.split(':');
        if (parts.length !== 2) {
            securityLogger.warn({ ns: 'security:site' }, 'Decrypted payload missing timestamp separator');
            return false;
        }

        const [receivedApiKey, timestampStr] = parts;
        const receivedTimestamp = parseInt(timestampStr, 10);
        const currentTimestamp = Math.floor(Date.now() / 1000);

        // 1. Verify API Key matches
        if (receivedApiKey !== config.EXPECTED_WIDGET_API_KEY) {
            securityLogger.warn({ ns: 'security:site' }, 'API Key in payload is incorrect');
            return false;
        }

        // 2. Verify Timestamp is not a "Replay" (too old or too far in the future)
        const drift = Math.abs(currentTimestamp - receivedTimestamp);
        if (drift > MAX_TIME_DRIFT_SECONDS) {
            securityLogger.warn({ ns: 'security:site', received: receivedTimestamp, current: currentTimestamp, drift }, 'Site key has expired or clock drift too large');
            return false;
        }

        securityLogger.debug({ ns: 'security:site' }, 'Site verified successfully with dynamic key');
        return true;
    } catch (error) {
        securityLogger.error({ ns: 'security:site', error: (error as Error).message }, 'Validation error');
        return false;
    }
}
