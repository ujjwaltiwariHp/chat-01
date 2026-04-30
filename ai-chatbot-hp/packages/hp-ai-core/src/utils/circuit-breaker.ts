import CircuitBreaker from 'opossum';
import { logger } from '../logging/logger.js';

/**
 * Standardized Circuit Breaker Base
 * Provides unified logging and error reporting for all monorepo breakers.
 */
export interface GenericBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
  name?: string;
}

/**
 * Creates a type-safe circuit breaker with standard @hp-intelligence/core monitoring.
 */
export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  action: T, 
  options: GenericBreakerOptions = {}
): CircuitBreaker<Parameters<T>, any> {
  const breakerName = options.name || 'generic-breaker';
  const breakerLogger = logger.child({ ns: `circuit:${breakerName}` });

  const breaker = new CircuitBreaker(action as any, {
    timeout: options.timeout || 10000,
    errorThresholdPercentage: options.errorThresholdPercentage || 50,
    resetTimeout: options.resetTimeout || 30000,
    volumeThreshold: options.volumeThreshold || 10,
  });

  // Unified Monitoring
  breaker.on('open', () => {
    breakerLogger.warn({ threshold: options.errorThresholdPercentage }, `Circuit Breaker [${breakerName}] OPEN`);
  });

  breaker.on('halfOpen', () => {
    breakerLogger.info(`Circuit Breaker [${breakerName}] HALF-OPEN`);
  });

  breaker.on('close', () => {
    breakerLogger.info(`Circuit Breaker [${breakerName}] CLOSED (RECOVERED)`);
  });

  breaker.on('failure', (err: any) => {
    // We ignore expected timeouts/open circuit errors to avoid log spamming
    if (err.message !== 'Operation timed out' && err.message !== 'The circuit is open') {
      breakerLogger.error({ msg: 'Breaker recorded failure', error: err.message });
    }
  });

  return breaker as unknown as CircuitBreaker<Parameters<T>, any>;
}
