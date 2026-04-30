import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Create the 'tenants' table
  await knex.schema.createTable('tenants', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('slug').unique().notNullable();
    table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active');
    table.string('api_key').unique().nullable();
    table.integer('credits').notNullable().defaultTo(0);
    table.integer('version').notNullable().defaultTo(1); 
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 1.1 Business Logic Constraint: Credits can NEVER be negative
    table.check('credits >= 0', [], 'credits_non_negative');
  });

  // 1.2 Automatic UpdatedAt Management (Postgres Trigger)
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
  `);

  // 2. Add an initial 'Default Test Tenant' so existing tests don't break
  await knex('tenants').insert({
    id: '00000000-0000-0000-0000-000000000001',
    name: 'HangingPanda Test Corp',
    slug: 'hp-test-corp',
    status: 'active',
    credits: 100
  });

  // 3. Create the 'users' table (Multi-tenant Admin Users)
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').unique().notNullable();
    table.string('name').nullable();
    table.string('role').notNullable().defaultTo('user');
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 3.1 Scaling Indices: Ensure foreign keys are always indexed for query speed
    table.index(['tenant_id'], 'idx_users_tenant_id');
  });

  // 3.2 Add trigger to users also
  await knex.raw(`
    CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
  `);

  // 4. Add Foreign Key constraint to 'conversations' (Optional but recommended for integrity)
  await knex.schema.alterTable('conversations', (table) => {
    table.uuid('tenant_id').alter().references('id').inTable('tenants').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('conversations', (table) => {
    table.dropForeign(['tenant_id']);
  });
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('tenants');
}
