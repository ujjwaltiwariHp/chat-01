import { ApiError } from './api-error.js';
import { leadIntelligenceService } from '@/services/lead-intelligence.service.js';

/**
 * IP Allowlist Logic (Enterprise Tier)
 * Validates the incoming request IP against the tenant's configured allowlist.
 */
export async function assertIpAllowed(tenantId: string, ip: string) {
  const settings = await leadIntelligenceService.getSettingsRecord(tenantId);
  const allowlist = settings?.ipAllowlist || [];

  if (allowlist.length === 0) {
    return; // No restrictions
  }

  // Support for CIDR or exact match can be added here
  if (!allowlist.includes(ip)) {
    throw new ApiError('FORBIDDEN', `Access from IP ${ip} is not allowed by this tenant's security policy`);
  }
}
