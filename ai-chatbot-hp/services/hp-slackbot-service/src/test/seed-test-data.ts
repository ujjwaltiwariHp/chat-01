import dotenv from 'dotenv';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;

// Load env relative to root
dotenv.config({ path: path.join(import.meta.dirname, '../../../../.env') });

const TEST_TENANT_ID = process.env.TEST_TENANT_ID!;
const TEST_USER_ID = process.env.TEST_USER_ID!;

async function seed() {
  console.log('--- Seeding Test Data for Slackbot Integration ---');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // 1. Ensure Tenant exists (Migration usually does this, but let's be safe)
    const tenantCheck = await client.query('SELECT id FROM tenants WHERE id = $1', [TEST_TENANT_ID]);
    if (tenantCheck.rows.length === 0) {
      console.log('Tenant not found. Creating test tenant...');
      await client.query(`
        INSERT INTO tenants (id, name, slug, status, credits) 
        VALUES ($1, 'HangingPanda Test Corp', 'hp-test-corp', 'active', 1000)
      `, [TEST_TENANT_ID]);
    } else {
      console.log('Test tenant already exists. Resetting credits to 50000...');
      await client.query('UPDATE tenants SET credits = 50000 WHERE id = $1', [TEST_TENANT_ID]);
    }

    // 2. Ensure Test User exists with 'admin' role
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [TEST_USER_ID]);
    if (userCheck.rows.length === 0) {
      console.log('Test user not found. Creating admin user...');
      await client.query(`
        INSERT INTO users (id, email, name, role, tenant_id) 
        VALUES ($1, 'admin@hp-test-corp.com', 'Admin User', 'admin', $2)
      `, [TEST_USER_ID, TEST_TENANT_ID]);
    } else {
      console.log('Test user already exists. Updating role to admin...');
      await client.query('UPDATE users SET role = \'admin\' WHERE id = $1', [TEST_USER_ID]);
    }

    console.log('✅ SEEDING COMPLETE.');
  } catch (error: any) {
    console.error('❌ SEEDING FAILED:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed().catch(console.error);
