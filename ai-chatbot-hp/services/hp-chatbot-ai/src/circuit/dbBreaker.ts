import { createCircuitBreaker } from '@hp-intelligence/core';

/**
 * Standardized Database Circuit Breaker
 * Logic localized in Chatbot AI but pattern centralized in @hp-intelligence/core.
 */
export const dbBreaker = createCircuitBreaker(
  async <T>(action: () => Promise<T>): Promise<T> => {
    return action();
  },
  {
    name: 'db',
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 15000,
    volumeThreshold: 10,
  }
);
