import Link from 'next/link';
import { BrandMark } from 'core/components/BrandMark';
import MarketingHeaderActions from './MarketingHeaderActions';

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 z-50 bg-white/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20 gap-4 min-w-0">
            <Link href="/home" className="hover:opacity-80 transition-opacity shrink-0">
              <BrandMark 
                imageClassName="h-14 w-auto" 
                showText={false}
              />
            </Link>
            
            <div className="min-w-0 flex-1 flex justify-end">
              <MarketingHeaderActions />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center">
            <BrandMark 
              imageClassName="h-10 w-auto mb-4" 
              showText={false}
            />
            <div className="text-center text-sm text-gray-600">
              <p>&copy; {new Date().getFullYear()} CBM Plastics Rewards. All rights reserved.</p>
              <p className="mt-2">An employee rewards merch shop.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

