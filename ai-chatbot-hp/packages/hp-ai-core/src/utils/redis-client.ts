import Redis from "ioredis";
import { logger } from "../logging/logger.js";
import { CoreErrorCode } from "../errors/error-codes.js";
import { config } from "../config/base-config.js";

const redisLogger = logger.child({ ns: "core:redis" });

/**
 * Standard Redis Client Module
 * Features managed reconnection and robust event handling.
 */
export const redis = new Redis(config.REDIS_URL || "redis://localhost:6379", {
  lazyConnect: true, // Prevents hanging on import in CLI/migrations
  maxRetriesPerRequest: null, // Critical: Don't kill process on single request failure
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000); // Caps delay at 3s
    redisLogger.warn({ times, delay }, "redis.reconnecting");
    return delay;
  },
  reconnectOnError(err) {
    const targetError = "READONLY";
    if (err.message.includes(targetError)) {
      return true; // Reconnect on ReadOnly errors (good for AWS ElastiCache failover)
    }
    return false;
  },
});

// --- Event Handlers for Observability ---

redis.on("connect", () => {
  redisLogger.info({ msg: "Connecting to Redis server..." }, "redis.connect");
});

redis.on("ready", () => {
  redisLogger.info({ msg: "Redis is ready to accept commands" }, "redis.ready");
});

redis.on("error", (err: any) => {
  redisLogger.error(
    {
      msg: "Redis connection error",
      error: err.message,
      code: CoreErrorCode.INTERNAL_SERVER_ERROR,
    },
    "redis.error",
  );
});

redis.on("close", () => {
  redisLogger.warn({ msg: "Redis connection closed" }, "redis.close");
});

redis.on("end", () => {
  redisLogger.fatal({ msg: "Redis connection ended permanently" }, "redis.end");
});
