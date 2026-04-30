import { z } from "zod";
import dns from "dns/promises";
import { LeadErrorMessages } from "@errors/error-messages.js";
import { createLeadLogger } from "@/logging/logger.js";
import { ApiError } from "@/utils/api-error.js";

const ingestionLogger = createLeadLogger("ingestion:validator");

/**
 * C12: Role-based email filtering
 */
const ROLE_EMAILS = [
  "info@",
  "sales@",
  "support@",
  "admin@",
  "contact@",
  "hello@",
  "marketing@",
];

const JUNK_KEYWORDS = [
  "test",
  "qwerty",
  "asdfgh",
  "123456",
  "spam",
  "buy bitcoin",
  "seo services",
  "poker",
  "casino",
  "viagra",
  "cialis",
  "weight loss",
  "work from home",
  "fast cash",
  "unlimited views",
];

export class IngestionValidator {
  /**
   * Comprehensive Lead Validation
   */
  static async validateLeadSourceData(data: {
    email?: string;
    phone?: string;
    source: string;
  }) {
    if (!data.email && !data.phone) {
      throw new ApiError(
        "COMMON_VALIDATION_ERROR",
        LeadErrorMessages.validation.leadRequiresEmailOrPhone,
      );
    }

    if (data.email) {
      await this.validateEmail(data.email);
    }
  }

  static async validateEmail(email: string) {
    const trimmedEmail = email.trim().toLowerCase();

    // 1. Format
    const emailSchema = z.email();
    if (!emailSchema.safeParse(trimmedEmail).success) {
      throw new ApiError(
        "COMMON_VALIDATION_ERROR",
        LeadErrorMessages.validation.invalidEmailFormat(email),
      );
    }

    // 2. Role-based check (C12)
    const isRoleBased = ROLE_EMAILS.some((role) =>
      trimmedEmail.startsWith(role),
    );
    if (isRoleBased) {
      ingestionLogger.warn({ email }, "Role-based email detected");
      // We allow them but log it for potential lower prioritization
    }

    // 3. MX Lookup (C12)
    const domain = trimmedEmail.split("@")[1];
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        throw new Error("No MX records found");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown MX lookup error";
      ingestionLogger.error(
        { domain, error: errorMessage },
        "Domain verification failed",
      );
      throw new ApiError(
        "COMMON_VALIDATION_ERROR",
        LeadErrorMessages.validation.invalidMailDomain(domain),
      );
    }
  }

  /**
   * C13: Hard Disqualification Gates
   * Returns true if lead should be discarded immediately
   */
  static isHardDisqualified(payload: any): boolean {
    const text = JSON.stringify(payload).toLowerCase();

    // Junk keywords
    const hasJunk = JUNK_KEYWORDS.some((k) => text.includes(k));

    if (hasJunk) return true;

    // Minimum quality check
    if (payload.message && payload.message.length < 5) return true;

    return false;
  }
}
