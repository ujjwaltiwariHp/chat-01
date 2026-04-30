import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import crypto from "crypto";
import { and, eq, or } from "drizzle-orm";
import {
  AuthMode,
  AuthResult,
  AuthError,
  safeCompare,
  tenants,
} from "@hp-intelligence/core";
import { LeadErrorMessages } from "@errors/error-messages.js";
import { config } from "@/config.js";
import { createLeadLogger } from "@/logging/logger.js";

declare module "fastify" {
  interface FastifyRequest {
    tenantId?: string;
    actorId?: string;
    userId?: string;
  }
}

const authLogger = createLeadLogger("auth");

const hashApiKey = (apiKey: string) =>
  crypto.createHash("sha256").update(apiKey).digest("hex");

const authenticateLeadRequest = async (request: FastifyRequest) => {
  const serviceToken = request.headers["x-service-token"] as string | undefined;

  if (
    serviceToken &&
    (safeCompare(serviceToken, config.INTERNAL_SERVICE_TOKEN) ||
      (config.GATEWAY_SERVICE_SECRET
        ? safeCompare(serviceToken, config.GATEWAY_SERVICE_SECRET)
        : false))
  ) {
    request.authMode = "INTERNAL";
    request.tenantId =
      (request.headers["x-tenant-id"] as string | undefined)?.trim() ||
      undefined;
    request.actorId =
      (request.headers["x-actor-id"] as string | undefined)?.trim() ||
      undefined;
    request.userId =
      (request.headers["x-user-id"] as string | undefined)?.trim() ||
      (request.headers["x-customer-id"] as string | undefined)?.trim() ||
      request.actorId ||
      "internal-service";
    return;
  }

  const apiKey = (request.headers["x-api-key"] as string | undefined)?.trim();
  if (!apiKey) {
    throw new AuthError(
      LeadErrorMessages.auth.apiKeyHeaderRequired,
      "AUTH_MISSING",
    );
  }

  const hashedApiKey = hashApiKey(apiKey);
  const [tenant] = await request.server.db
    .select({
      id: (tenants as any).id,
      status: (tenants as any).status,
    })
    .from(tenants as any)
    .where(
      and(
        or(
          eq((tenants as any).apiKey, hashedApiKey),
          eq((tenants as any).apiKey, apiKey),
        ) as any,
        eq((tenants as any).status, "active") as any,
      ) as any,
    )
    .limit(1);

  if (!tenant) {
    authLogger.warn(
      { requestId: request.id },
      "Lead API key validation failed",
    );
    throw new AuthError(LeadErrorMessages.auth.invalidApiKey, "AUTH_INVALID");
  }

  request.authMode = "STANDALONE";
  request.tenantId = tenant.id;
  request.actorId =
    (request.headers["x-actor-id"] as string | undefined)?.trim() || undefined;
  request.userId = request.actorId || "api-key";
};

const leadAuthModule: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook("onRequest", authenticateLeadRequest);
};

export const leadAuthPlugin = fp(leadAuthModule, {
  name: "hp-lead-auth",
  fastify: "5.x",
});

export default leadAuthPlugin;
