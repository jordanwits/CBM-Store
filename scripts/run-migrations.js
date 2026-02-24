/**
 * Run Supabase migrations via direct PostgreSQL connection.
 * Requires SUPABASE_DB_PASSWORD in .env.local (from Supabase Dashboard > Project Settings > Database)
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

function getConnectionConfig() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (dbUrl && !dbUrl.includes('your-')) {
    return { connectionString: dbUrl, ssl: { rejectUnauthorized: false } };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;

  if (!url || url.includes('your-project')) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL not set or invalid in .env.local');
    process.exit(1);
  }

  if (!password || password === 'your-db-password') {
    console.error('❌ SUPABASE_DB_PASSWORD not set in .env.local');
    console.error('   Or use SUPABASE_DB_URL with full connection string from Dashboard > Connect');
    process.exit(1);
  }

  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  const projectRef = match ? match[1] : null;
  if (!projectRef) {
    console.error('❌ Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL');
    process.exit(1);
  }

  const poolerUrl = process.env.SUPABASE_POOLER_URL;
  let poolerHost;
  if (poolerUrl && !poolerUrl.includes('your-')) {
    poolerHost = poolerUrl.replace(/^https?:\/\//, '').split(':')[0];
  } else {
    poolerHost = 'aws-0-us-east-1.pooler.supabase.com';
  }

  return {
    host: poolerHost,
    port: 5432,
    database: 'postgres',
    user: `postgres.${projectRef}`,
    password,
    ssl: { rejectUnauthorized: false },
  };
}

function getConnectionConfigs() {
  const base = getConnectionConfig();
  if (base.connectionString) return [base];
  const poolerUrl = process.env.SUPABASE_POOLER_URL;
  const regions = ['us-east-1', 'us-west-1', 'eu-west-1', 'ap-southeast-1'];
  const configs = regions.map((r) => ({
    ...base,
    host: `aws-0-${r}.pooler.supabase.com`,
  }));
  if (poolerUrl && !poolerUrl.includes('your-')) {
    const host = poolerUrl.replace(/^https?:\/\//, '').split(':')[0];
    configs.unshift({ ...base, host });
  }
  return configs;
}

async function runMigrations() {
  const configs = getConnectionConfigs();
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.error('No migration files found');
    process.exit(1);
  }

  console.log(`Found ${files.length} migration(s)\n`);

  let client;
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    client = new Client(config);
    try {
      await client.connect();
      console.log(`Connected to database (${config.host || 'connection string'})\n`);
      break;
    } catch (err) {
      await client.end().catch(() => {});
      if (i < configs.length - 1) continue;
      throw err;
    }
  }

  try {

    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      process.stdout.write(`Running ${file}... `);
      try {
        await client.query(sql);
        console.log('✓');
      } catch (err) {
        if (err.message.includes('already exists') || err.code === '42P07' || err.code === '23505') {
          console.log('(skipped - already applied)');
        } else {
          console.error('\n❌', err.message);
          throw err;
        }
      }
    }

    console.log('\n✅ All migrations completed');
  } finally {
    await client.end();
  }
}

runMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});
