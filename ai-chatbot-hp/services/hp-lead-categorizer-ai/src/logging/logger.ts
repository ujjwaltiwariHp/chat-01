import { createRedactedLogger, type Logger } from '@hp-intelligence/core';

const LEAD_LOG_REDACTION_PATHS = [
  'email',
  'phone',
  'name',
  'fullName',
  'company_name',
  'companyName',
  'raw_data',
  'rawData',
  'normalized_data',
  'normalizedData',
  'payload.email',
  'payload.phone',
  'payload.name',
  'payload.fullName',
  'visitor.email',
  'visitor.phone',
  'visitor.name',
  'payload.visitor.email',
  'payload.visitor.phone',
  'rawPayload.visitor.email',
  'rawPayload.visitor.phone',
  'manualData.email',
  'manualData.phone',
];

const leadRootLogger = createRedactedLogger('lead-intelligence', {
  additionalPaths: LEAD_LOG_REDACTION_PATHS,
});

export const createLeadLogger = (namespace: string): Logger => {
  return leadRootLogger.child({
    ns: `lead-intelligence:${namespace}`,
  });
};

export const logger = createLeadLogger('app');

export default logger;
