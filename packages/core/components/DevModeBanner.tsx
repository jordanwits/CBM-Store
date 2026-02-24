'use client';

export default function DevModeBanner() {
  // Check if Supabase is configured
  // Note: process.env values are replaced at build time in client components
  const hasSupabaseConfig =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  if (hasSupabaseConfig) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border-b border-yellow-300">
      <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center">
          <p className="text-sm text-yellow-900">
            <strong>⚠️ Dev Mode:</strong> Supabase not configured. Copy .env.example to .env.local and add your Supabase credentials.
          </p>
        </div>
      </div>
    </div>
  );
}
