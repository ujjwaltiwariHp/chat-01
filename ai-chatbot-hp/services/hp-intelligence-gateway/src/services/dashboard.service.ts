import crypto from 'crypto';
import { pool } from '@/db/connection.js';
import { ApiError, redis } from '@hp-intelligence/core';

const BILLING_CYCLE_DAYS = 30;

type DashboardCustomerRow = {
  id: string;
  email: string;
  api_key: string;
  plan: string;
  conversations_limit: number;
  reset_date: Date | string;
  widget_config: Record<string, unknown> | null;
  enabled: boolean;
};

type UsageHistoryRow = {
  usage_date: Date | string;
  conversation_count: number | string;
};

type UsageHistoryPoint = {
  date: string;
  count: number;
};

const toUtcDateOnly = (value: Date | string): Date => {
  const date = new Date(value);

  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
};

const toDateKey = (value: Date | string): string => {
  return toUtcDateOnly(value).toISOString().slice(0, 10);
};

const buildUsageHistory = (startDate: Date, rows: UsageHistoryRow[]): UsageHistoryPoint[] => {
  const countsByDate = new Map(
    rows.map((row) => [toDateKey(row.usage_date), Number(row.conversation_count)]),
  );

  const history: UsageHistoryPoint[] = [];
  const cursor = new Date(startDate);
  const today = toUtcDateOnly(new Date());

  while (cursor <= today) {
    const key = cursor.toISOString().slice(0, 10);
    history.push({
      date: key,
      count: countsByDate.get(key) ?? 0,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return history;
};

const deriveHistoryStartDate = (resetDateValue: Date | string): Date => {
  const resetDate = toUtcDateOnly(resetDateValue);
  const today = toUtcDateOnly(new Date());

  if (resetDate > today) {
    const currentCycleStart = new Date(resetDate);
    currentCycleStart.setUTCDate(currentCycleStart.getUTCDate() - BILLING_CYCLE_DAYS);
    return currentCycleStart;
  }

  const fallbackStart = new Date(today);
  fallbackStart.setUTCDate(fallbackStart.getUTCDate() - (BILLING_CYCLE_DAYS - 1));
  return fallbackStart;
};

const getCustomerByEmail = async (email: string): Promise<DashboardCustomerRow> => {
  const result = await pool.query<DashboardCustomerRow>(
    `
      SELECT id, email, api_key, plan, conversations_limit, reset_date, widget_config, enabled
      FROM widget_customers
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email],
  );

  const customer = result.rows[0];

  if (!customer) {
    throw new ApiError('NOT_FOUND', 'No widget dashboard account was found for this email address');
  }

  return customer;
};

const countConversationsFromDatabase = async (customerId: string, startDate: Date): Promise<number> => {
  const result = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*)::int AS count
      FROM conversations
      WHERE customer_id = $1
        AND source = 'widget'
        AND created_at >= $2
    `,
    [customerId, startDate],
  );

  return Number(result.rows[0]?.count ?? 0);
};

export const dashboardService = {
  async getUsage(email: string) {
    const customer = await getCustomerByEmail(email);
    const historyStartDate = deriveHistoryStartDate(customer.reset_date);

    let currentCount = 0;

    try {
      const usageValue = await redis.get(`widget:usage:${customer.id}`);
      currentCount = Number.parseInt(usageValue ?? '0', 10);

      if (Number.isNaN(currentCount)) {
        currentCount = 0;
      }
    } catch {
      currentCount = await countConversationsFromDatabase(customer.id, historyStartDate);
    }

    const historyResult = await pool.query<UsageHistoryRow>(
      `
        SELECT DATE_TRUNC('day', created_at)::date AS usage_date, COUNT(*)::int AS conversation_count
        FROM conversations
        WHERE customer_id = $1
          AND source = 'widget'
          AND created_at >= $2
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      [customer.id, historyStartDate],
    );

    return {
      currentCount,
      limit: customer.conversations_limit,
      plan: customer.plan,
      resetDate: new Date(customer.reset_date).toISOString(),
      usageHistory: buildUsageHistory(historyStartDate, historyResult.rows),
    };
  },

  async updateConfig(email: string, updates: Record<string, unknown>) {
    const customer = await getCustomerByEmail(email);
    const nextConfig = {
      ...(customer.widget_config ?? {}),
      ...updates,
    };

    await pool.query(
      `
        UPDATE widget_customers
        SET widget_config = $1::jsonb
        WHERE id = $2
      `,
      [JSON.stringify(nextConfig), customer.id],
    );

    return {
      widgetConfig: nextConfig,
    };
  },

  async rotateApiKey(email: string) {
    const customer = await getCustomerByEmail(email);
    const nextApiKey = `hp_widget_${crypto.randomBytes(24).toString('hex')}`;

    await pool.query(
      `
        UPDATE widget_customers
        SET api_key = $1
        WHERE id = $2
      `,
      [nextApiKey, customer.id],
    );

    return {
      apiKey: nextApiKey,
      previousApiKeyLast4: customer.api_key.slice(-4),
    };
  },
};
