/**
 * Run Supabase migrations via Management API.
 * Requires SUPABASE_ACCESS_TOKEN in .env.local (from https://supabase.com/dashboard/account/tokens)
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

function getProjectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes('your-project')) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL not set');
    process.exit(1);
  }
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
}

async function runQuery(projectRef, token, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
  return res.json();
}

async function runMigrations() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token || token.includes('your-')) {
    console.error('❌ SUPABASE_ACCESS_TOKEN not set in .env.local');
    console.error('   Create one at: https://supabase.com/dashboard/account/tokens');
    process.exit(1);
  }

  const projectRef = getProjectRef();
  if (!projectRef) {
    console.error('❌ Could not parse project ref');
    process.exit(1);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration(s)\n`);

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    process.stdout.write(`Running ${file}... `);
    try {
      await runQuery(projectRef, token, sql);
      console.log('✓');
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('42P07')) {
        console.log('(skipped - already applied)');
      } else {
        console.error('\n❌', err.message);
        process.exit(1);
      }
    }
  }

  console.log('\n✅ All migrations completed');
}

runMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});
