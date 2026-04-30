import crypto from 'crypto';
import type { FastifyRequest } from 'fastify';
import { AuthError } from '../utils/api-error.js';
import { safeCompare } from '../utils/safe-compare.js';
import { logger } from '../logging/logger.js';

const SERVICE_SIGNATURE_MAX_SKEW_SECONDS = 300;

type SignedServiceHeaderInput = {
  serviceSecret: string;
  serviceName: string;
  method: string;
  path: string;
  tenantId?: string;
  customerId?: string;
  requestId?: string;
  sessionId?: string;
};

type ValidateSignedServiceRequestInput = {
  request: FastifyRequest;
  serviceSecret: string;
  expectedServiceName: string;
  redis?: {
    set: (...args: any[]) => Promise<any>;
  } | null;
};

const normalizePath = (path: string): string => {
  const parsed = new URL(path, 'http://internal.local');
  return `${parsed.pathname}${parsed.search}`;
};

const buildSignaturePayload = ({
  serviceName,
  method,
  path,
  tenantId,
  customerId,
  requestId,
  sessionId,
  timestamp,
}: SignedServiceHeaderInput & { timestamp: string }): string => [
  serviceName.trim().toLowerCase(),
  method.trim().toUpperCase(),
  normalizePath(path),
  tenantId?.trim() || '',
  customerId?.trim() || '',
  requestId?.trim() || '',
  sessionId?.trim() || '',
  timestamp,
].join('\n');

const signPayload = (payload: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

export const buildSignedServiceHeaders = (input: SignedServiceHeaderInput) => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = buildSignaturePayload({ ...input, timestamp });
  const signature = signPayload(payload, input.serviceSecret);

  return {
    'X-Service-Name': input.serviceName,
    'X-Service-Timestamp': timestamp,
    'X-Service-Signature': signature,
  };
};

export const validateSignedServiceRequest = async ({
  request,
  serviceSecret,
  expectedServiceName,
  redis,
}: ValidateSignedServiceRequestInput): Promise<void> => {
  const serviceName = (request.headers['x-service-name'] as string | undefined)?.trim().toLowerCase();
  const timestamp = (request.headers['x-service-timestamp'] as string | undefined)?.trim();
  const signature = (request.headers['x-service-signature'] as string | undefined)?.trim();
  const tenantId = request.headers['x-tenant-id'] as string | undefined;
  const customerId = request.headers['x-customer-id'] as string | undefined;
  const requestId = request.headers['x-request-id'] as string | undefined;
  const sessionId = request.headers['x-session-id'] as string | undefined;

  if (!serviceName || !timestamp || !signature) {
    throw new AuthError('Missing signed service request headers', 'AUTH_INVALID');
  }

  if (serviceName !== expectedServiceName.trim().toLowerCase()) {
    throw new AuthError('Unexpected service identity for signed internal request', 'AUTH_INVALID');
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    throw new AuthError('Invalid service request timestamp', 'AUTH_INVALID');
  }

  const currentTimeSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTimeSeconds - timestampSeconds) > SERVICE_SIGNATURE_MAX_SKEW_SECONDS) {
    throw new AuthError('Expired or future-dated signed internal request', 'AUTH_INVALID');
  }

  const payload = buildSignaturePayload({
    serviceSecret,
    serviceName,
    method: request.method,
    path: request.url,
    tenantId,
    customerId,
    requestId,
    sessionId,
    timestamp,
  });

  const expectedSignature = signPayload(payload, serviceSecret);
  if (!safeCompare(signature, expectedSignature)) {
    throw new AuthError('Invalid internal request signature', 'AUTH_INVALID');
  }

  if (!redis) {
    // Signed internal requests should normally have Redis available for replay protection.
    // We log loudly here so environments do not silently lose this safeguard.
    logger.error({ ns: 'auth:service-signing' }, 'Replay protection skipped because Redis is unavailable');
    return;
  }

  const replayKey = `auth:replay:${serviceName}:${signature}`;
  const replayGuard = await redis.set(replayKey, '1', 'EX', SERVICE_SIGNATURE_MAX_SKEW_SECONDS, 'NX');

  if (replayGuard !== 'OK') {
    throw new AuthError('Replay detected for signed internal request', 'AUTH_INVALID');
  }
};
