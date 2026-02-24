SUPABASE SETUP INSTRUCTIONS
===========================

1. Create a new Supabase project at https://app.supabase.com

2. Run the migrations in order:
   - Go to SQL Editor in your Supabase dashboard
   - Copy and paste the contents of each migration file in order:
     a) migrations/001_initial_schema.sql
     b) migrations/002_rls_policies.sql
     c) migrations/003_seed_data.sql (optional, for test data)
   - Execute each one

3. Get your credentials:
   - Go to Project Settings > API
   - Copy the Project URL (NEXT_PUBLIC_SUPABASE_URL)
   - Copy the anon/public key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - Copy the service_role key (SUPABASE_SERVICE_ROLE_KEY)

4. Create .env.local in apps/affinity-stone:
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

5. Create your first admin user:
   - Go to Authentication > Users in Supabase dashboard
   - Create a new user with email/password
   - Go to SQL Editor and run:
     UPDATE profiles SET role = 'admin' WHERE email = 'your-admin-email@company.com';

6. Test the setup:
   - Run: pnpm install
   - Run: pnpm dev
   - Visit http://localhost:3000
   - Login with your admin credentials
   - You should see the dashboard and have access to the Admin panel

NOTES:
- The service_role key should NEVER be exposed to the browser
- Only use it in server-side code (Server Components, Server Actions)
- All user-facing operations use the anon key with RLS protection
