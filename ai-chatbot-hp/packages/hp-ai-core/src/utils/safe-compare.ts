import crypto from 'crypto';

/**
 * Constant-time string comparison.
 * Hashes both inputs to SHA-256 before comparing, ensuring:
 * 1. Equal-length buffers regardless of input (no length leak)
 * 2. Constant-time via crypto.timingSafeEqual
 */
export function safeCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}
