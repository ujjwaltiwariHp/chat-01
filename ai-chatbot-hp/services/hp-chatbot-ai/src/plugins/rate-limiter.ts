import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import fp from "fastify-plugin";
import {
  checkBusinessLimit,
  redis,
  ApiError,
  logger,
} from "@hp-intelligence/core";

const rlLogger = logger.child({ ns: "chat:limit" });

/**
 * Local Daily Usage Quota logic for Chatbot Service
 */
async function checkDailyQuota(key: string, limit: number, errorSlug: string) {
  const result = await redis.incr(key);

  if (result === 1) {
    await redis.expire(key, 86400); // 24 hours
  }

  if (result > limit) {
    rlLogger.warn({ key, result, limit }, "Daily Quota Exceeded");
    throw new ApiError(
      errorSlug as any,
      `Daily limit reached. Resets in 24 hours.`,
    );
  }
}

/**
 * Service-Specific Session Rate Limiter
 * Limits chatbot interactions per-session using shared core logic.
 */
export const sessionChatLimitHook = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const sessionId =
    (request as any).sessionId || request.headers["x-session-id"];
  const ip = request.ip;

  // 1. Minute-Level Session Rate Limiting (Spam Protection)
  if (sessionId) {
    const rlKey = `rl:chat:session:${sessionId}`;
    const rpmLimit = (request as any).plan === "pro" ? 60 : 10;
    await checkBusinessLimit(rlKey, rpmLimit, 60);
  }

  // 2. Daily Session Limit (20 messages per session per day)
  // Each POST /invoke = 1 user interaction. The assistant response is streamed
  // back in the same request cycle and does NOT hit this preHandler hook again.
  if (sessionId) {
    const dqSessionKey = `dq:chat:session:${sessionId}`;
    const dailyLimit = 20;
    await checkDailyQuota(
      dqSessionKey,
      dailyLimit,
      "SESSION_DAILY_LIMIT_EXCEEDED",
    );
  }

  // 3. Daily IP Limit (100 messages per IP per day)
  if (ip) {
    const dqIpKey = `dq:chat:ip:${ip}`;
    const ipDailyLimit = 100;
    await checkDailyQuota(dqIpKey, ipDailyLimit, "IP_DAILY_LIMIT_EXCEEDED");
  }
};

/**
 * Session Chat Rate Limit Plugin
 */
const sessionChatLimitModule: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  fastify.addHook("preHandler", sessionChatLimitHook);
};

export const sessionChatLimitPlugin = fp(sessionChatLimitModule);
export default sessionChatLimitPlugin;
