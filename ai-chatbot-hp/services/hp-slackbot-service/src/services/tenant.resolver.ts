import { logger, CoreErrorCode, AuthError } from '@hp-intelligence/core';
import { slackTeamInstalls } from '@hp-intelligence/core';
import { eq } from 'drizzle-orm';
import { config } from '@config/index.js';

export class TenantResolver {
  private log = logger.child({ ns: 'tenant:resolver' });

  constructor(
    private readonly db: any,
    private readonly redis: any,
  ) {}

  /**
   * P10: Resolves the Tenant ID for a Slack Workspace with Redis Caching
   * NO FALLBACKS allowed in production or development.
   */
  async resolveTenantId(teamId?: string): Promise<string> {
    this.log.debug({ teamId }, 'Resolving tenant ID for Slack workspace');

    if (!teamId) {
      throw new AuthError('Missing Slack Team ID', CoreErrorCode.AUTH_INVALID);
    }

    // 1. High-Performance Redis Cache Lookup
    const cacheKey = `tenant:slack:${teamId}`;
    const cachedTenantId = await this.redis?.get(cacheKey);

    if (cachedTenantId) {
      this.log.debug({ teamId, cachedTenantId }, 'Tenant resolution cache hit');
      return cachedTenantId;
    }

    // 2. Database Source of Truth
    this.log.info({ teamId }, 'Tenant resolution cache miss, querying database');
    const [mapping] = await this.db.select()
      .from(slackTeamInstalls)
      .where(eq((slackTeamInstalls.teamId as any), teamId));

    if (!mapping) {
      this.log.error({ teamId }, 'Slack workspace not authorized for this platform');
      throw new AuthError(`Workplace ${teamId} is not registered`, 'SLACK_AUTH_001');
    }

    // 3. Update Cache (TTL: 1 Hour)
    await this.redis?.set(cacheKey, mapping.tenantId, 'EX', 3600);

    this.log.info({ teamId, tenantId: mapping.tenantId }, 'Tenant resolution complete and cached');
    return mapping.tenantId;
  }

  /**
   * Resolves the Bot-specific Slack Token (from DB)
   */
  async resolveBotToken(teamId: string): Promise<string> {
    const [mapping] = await this.db.select()
      .from(slackTeamInstalls)
      .where(eq((slackTeamInstalls.teamId as any), teamId));

    if (!mapping) {
      throw new AuthError(`Workplace ${teamId} has no bot token installed`, 'SLACK_AUTH_002');
    }

    return mapping.botToken;
  }

  /**
   * Deterministic Session Construction
   */
  buildSessionId(teamId: string, channelId: string, threadTs?: string): string {
    return `slack:${teamId}:${channelId}:${threadTs ?? 'root'}`;
  }
}

export function createTenantResolver(db: any, redis: any): TenantResolver {
  return new TenantResolver(db, redis);
}
