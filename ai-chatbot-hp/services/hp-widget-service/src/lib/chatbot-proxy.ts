import { buildSignedServiceHeaders } from '@hp-intelligence/core';

export const CHATBOT_INVOKE_PATH = '/api/v1/chat/invoke';

export type WidgetProxyRequestOptions = {
  chatbotServiceUrl: string;
  widgetServiceSecret: string;
  customerId: string;
  tenantId: string;
  requestId: string;
  sessionId?: string;
  authorization?: string;
};

export const buildWidgetChatProxyRequest = ({
  chatbotServiceUrl,
  widgetServiceSecret,
  customerId,
  tenantId,
  requestId,
  sessionId,
  authorization,
}: WidgetProxyRequestOptions) => ({
  url: `${chatbotServiceUrl}${CHATBOT_INVOKE_PATH}`,
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Token': widgetServiceSecret,
    'X-Customer-ID': customerId,
    'X-Tenant-ID': tenantId,
    'X-Request-ID': requestId,
    ...buildSignedServiceHeaders({
      serviceSecret: widgetServiceSecret,
      serviceName: 'widget-service',
      method: 'POST',
      path: CHATBOT_INVOKE_PATH,
      tenantId,
      customerId,
      requestId,
      sessionId,
    }),
    ...(sessionId ? { 'X-Session-ID': sessionId } : {}),
    ...(authorization ? { Authorization: authorization } : {}),
  },
});
