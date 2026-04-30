import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { 
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAMESPACE, 
} from '@opentelemetry/semantic-conventions/incubating';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { config } from '@/config.js';
import { createLeadLogger } from '@/logging/logger.js';

/**
 * G18: OpenTelemetry SDK
 * Standards for traceparent propagation and spans.
 */
let sdk: NodeSDK | null = null;
const otelLogger = createLeadLogger('observability:otel');

export const initOTEL = () => {
  if (sdk) return;

  const exporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.SERVICE_NAME,
      [ATTR_SERVICE_NAMESPACE]: 'hp-intelligence',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.NODE_ENV,
    }),
    spanProcessor: new BatchSpanProcessor(exporter),
  });

  sdk.start();
  otelLogger.info('OpenTelemetry SDK started');

  process.on('SIGTERM', () => {
    sdk?.shutdown()
      .then(() => otelLogger.info('OTEL SDK shut down'))
      .catch((err: any) => otelLogger.error({ err }, 'Error shutting down OTEL SDK'))
      .finally(() => process.exit(0));
  });
};
