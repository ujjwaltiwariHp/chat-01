import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection.js';
import { 
  users, 
  magicLinkTokens, 
  tenants, 
  eq, 
  and, 
  gt,
  sendMagicLinkEmail, 
  redis, 
  logger, 
  ApiError 
} from '@hp-intelligence/core';
import { config } from '../config.js';

const authLogger = logger.child({ ns: 'auth:service' });

export const authService = {
  /**
   * P5-02: Generate Magic Link Token and Send Email
   * Includes 3/hr rate limit per email via Redis.
   */
  async requestMagicLink(email: string) {
    const emailKey = `rate:magic:${email}`;
    
    // 1. Check Rate Limit (3 per hour)
    const count = await redis.get(emailKey);
    if (count && parseInt(count) >= 3) {
      throw new ApiError('SESSION_RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again in an hour.');
    }

    // 2. Resolve Tenant
    const [tenant] = await (db.select().from(tenants as any).where(eq(tenants.status, 'active') as any).limit(1) as any);
    const tenantId = (tenant as any)?.id;

    // 3. Generate Token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // 4. Save to DB
    await (db.insert(magicLinkTokens as any).values({
      email,
      token,
      expiresAt,
      tenantId,
    }) as any);

    // 5. Send Email
    const verifyUrl = `${config.DASHBOARD_URL.split('/dashboard')[0]}/api/v1/auth/verify?token=${token}`;
    await sendMagicLinkEmail(email, verifyUrl);

    // 6. Update Rate Limit in Redis (Expires in 1 hour)
    const pipeline = redis.pipeline();
    pipeline.incr(emailKey);
    pipeline.expire(emailKey, 3600);
    await pipeline.exec();

    authLogger.info({ email, tenantId }, 'Magic link requested');
  },

  /**
   * P5-03: Validate Token and Create Session JWT
   */
  async verifyMagicLink(token: string) {
    // 1. Find valid token
    const [record] = await (db
      .select()
      .from(magicLinkTokens as any)
      .where(
        and(
          eq(magicLinkTokens.token, token),
          eq(magicLinkTokens.used, 'false'),
          gt(magicLinkTokens.expiresAt, new Date())
        ) as any
      )
      .limit(1) as any);

    if (!record) {
      throw new ApiError('AUTH_TOKEN_INVALID', 'Invalid or expired magic link token');
    }

    // 2. Mark as used
    await (db.update(magicLinkTokens as any)
      .set({ used: 'true' })
      .where(eq(magicLinkTokens.id, (record as any).id) as any) as any);

    // 3. Find or Create User
    let [user] = await (db.select().from(users as any).where(eq(users.email, (record as any).email) as any).limit(1) as any);
    
    if (!user) {
      const inserts = await (db.insert(users as any).values({
        email: (record as any).email,
        tenantId: (record as any).tenantId,
        role: 'user',
      }).returning() as any);
      user = inserts[0];
    }

    // 4. Generate JWT
    const jwtToken = jwt.sign(
      { 
        id: (user as any).id, 
        sub: (user as any).id, 
        email: (user as any).email, 
        tid: (user as any).tenantId, 
        role: (user as any).role 
      },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { token: jwtToken, user };
  }
};
