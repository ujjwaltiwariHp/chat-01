import { buildSignedServiceHeaders } from '@hp-intelligence/core';

export const DEFAULT_INVOKE_PATH = '/api/v1/chat/invoke';

export type GatewayProxyRequestOptions = {
  botBaseUrl: string;
  gatewayServiceSecret: string;
  tenantId: string;
  requestId: string;
  sessionId?: string;
  customerId?: string;
  path?: string;
  forwardedProto?: string;
  forwardedHost?: string;
  forwardedCookie?: string;
  method?: string;
};

export const buildGatewayBotProxyRequest = ({
  botBaseUrl,
  gatewayServiceSecret,
  tenantId,
  requestId,
  sessionId,
  customerId,
  path = DEFAULT_INVOKE_PATH,
  forwardedProto,
  forwardedHost,
  forwardedCookie,
  method = 'POST',
}: GatewayProxyRequestOptions) => ({
  url: `${botBaseUrl}${path}`,
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Token': gatewayServiceSecret,
    'X-Tenant-ID': tenantId,
    'X-Request-ID': requestId,
    ...buildSignedServiceHeaders({
      serviceSecret: gatewayServiceSecret,
      serviceName: 'gateway',
      method,
      path,
      tenantId,
      customerId,
      requestId,
      sessionId,
    }),
    ...(sessionId ? { 'X-Session-ID': sessionId } : {}),
    ...(customerId ? { 'X-Customer-ID': customerId } : {}),
    ...(forwardedProto ? { 'X-Forwarded-Proto': forwardedProto } : {}),
    ...(forwardedHost ? { 'X-Forwarded-Host': forwardedHost } : {}),
    ...(forwardedCookie ? { 'Cookie': forwardedCookie } : {}),
  },
});
