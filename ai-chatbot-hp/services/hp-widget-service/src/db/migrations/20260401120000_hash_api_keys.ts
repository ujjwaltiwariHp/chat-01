import type { Knex } from 'knex';
import crypto from 'crypto';

/**
 * Hash existing API keys with SHA-256 for security enhancement.
 * (OWASP A07:2021 Implementation)
 */
export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('widget_customers');
  if (!tableExists) return;

  const customers = await knex('widget_customers').select('id', 'api_key');
  
  for (const customer of customers) {
    const rawKey = customer.api_key;
    // Check if it's already a 64-char hex hash (some might be migrated)
    const isAlreadyHashed = /^[a-f0-9]{64}$/.test(rawKey);
    
    if (!isAlreadyHashed) {
      const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');
      await knex('widget_customers')
        .where('id', customer.id)
        .update('api_key', hashedKey);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Irreversible operation. Hashing cannot be undone.
  // In a real staging environment, we would restore from a DB backup if required.
}
