import Link from 'next/link';
import CartIcon from './layout/CartIcon';
import NavLink from './layout/NavLink';
import UserControls from './layout/UserControls';
import { BrandMark } from 'core/components/BrandMark';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-300 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-3 lg:px-4">
          <div className="flex justify-between h-16 sm:h-20">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="hover:opacity-80 transition-opacity">
                <BrandMark showText={false} imageClassName="h-14 w-auto" />
              </Link>
              <div className="hidden md:flex space-x-1">
                <NavLink href="/dashboard">Shop</NavLink>
                <NavLink href="/orders">Orders</NavLink>
                <NavLink href="/points-history">Points</NavLink>
                <NavLink href="/profile">Profile</NavLink>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CartIcon />
              <UserControls isDevMode={isDevMode} />
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-[1600px] mx-auto pt-6 pb-20 lg:py-20 px-3 lg:px-4">
        {children}
      </main>
    </div>
  );
}
