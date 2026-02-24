import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from 'core/components/Button';
import { getCurrentUser } from '@/lib/auth/get-user';

// Must be dynamic: auth check uses cookies (Supabase session)
export const dynamic = 'force-dynamic';

// Separate auth check component to prevent blocking
async function AuthRedirect() {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (!isDevMode) {
    try {
      const user = await getCurrentUser();
      if (user) {
        redirect('/dashboard');
      }
    } catch (error) {
      // If auth check fails, continue to show home page
      // This prevents blocking on Supabase connection issues
      console.error('Auth check failed:', error);
    }
  }
  
  return null;
}

export default async function MarketingHomePage() {
  return (
    <>
      <Suspense fallback={null}>
        <AuthRedirect />
      </Suspense>
      <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gray-50">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-secondary/5 rounded-full blur-3xl"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6">
              <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm font-semibold text-primary">Employee Rewards Program</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 mb-6 leading-tight">
              Welcome to <br className="hidden sm:block" />
              CBM Plastics Rewards
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
              Turn your hard work into rewards. Redeem your earned points for company merchandise and show your team pride.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/request-access">
                <Button variant="primary" size="lg" className="shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
                  Request Access →
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="hover:bg-gray-50">
                  Login
                </Button>
              </Link>
            </div>
            
            {/* Trust indicators */}
            <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Secure & Private
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Easy to Use
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Branded Merchandise
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Get started in three simple steps and unlock your rewards
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {/* Step 1 */}
            <div className="relative group flex flex-col">
              <div className="bg-primary/5 p-8 rounded-2xl border-2 border-primary/20 hover:border-primary/40 transition-all hover:shadow-xl hover:shadow-primary/10 h-full flex flex-col">
                <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-primary">STEP 1</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Request Access</h3>
                <p className="text-gray-600 leading-relaxed flex-grow">
                  Submit your work email to request access to the company merch shop. Our team will review and approve your request within 24 hours.
                </p>
              </div>
              {/* Connector line */}
              <div className="hidden md:block absolute top-12 left-full w-full h-0.5 bg-primary/20 -ml-4"></div>
            </div>

            {/* Step 2 */}
            <div className="relative group flex flex-col">
              <div className="bg-secondary/5 p-8 rounded-2xl border-2 border-secondary/20 hover:border-secondary/40 transition-all hover:shadow-xl hover:shadow-secondary/10 h-full flex flex-col">
                <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-secondary/30 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-secondary">STEP 2</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Earn Points</h3>
                <p className="text-gray-600 leading-relaxed flex-grow">
                  Earn points through your accomplishments and contributions. Track your balance and see your impact in real-time.
                </p>
              </div>
              {/* Connector line */}
              <div className="hidden md:block absolute top-12 left-full w-full h-0.5 bg-secondary/20 -ml-4"></div>
            </div>

            {/* Step 3 */}
            <div className="relative group flex flex-col">
              <div className="bg-primary/5 p-8 rounded-2xl border-2 border-primary/20 hover:border-primary/40 transition-all hover:shadow-xl hover:shadow-primary/10 h-full flex flex-col">
                <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-primary">STEP 3</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Redeem Rewards</h3>
                <p className="text-gray-600 leading-relaxed flex-grow">
                  Browse our catalog of branded company merchandise and redeem your points for items that show your team pride.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Why CBM Plastics Rewards?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Recognition that matters, rewards you'll actually use
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
            <div className="group flex gap-5 p-6 bg-white rounded-xl border border-gray-200 hover:border-secondary/50 hover:shadow-lg transition-all">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center shadow-md shadow-secondary/30 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Show Team Pride</h3>
                <p className="text-gray-600">Represent your company with branded merchandise that shows you're part of the team.</p>
              </div>
            </div>

            <div className="group flex gap-5 p-6 bg-white rounded-xl border border-gray-200 hover:border-primary/50 hover:shadow-lg transition-all">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/30 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Easy to Use</h3>
                <p className="text-gray-600">Simple, intuitive interface makes browsing and ordering effortless. Shop in minutes, not hours.</p>
              </div>
            </div>

            <div className="group flex gap-5 p-6 bg-white rounded-xl border border-gray-200 hover:border-secondary/50 hover:shadow-lg transition-all">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center shadow-md shadow-secondary/30 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Recognition Rewards</h3>
                <p className="text-gray-600">Your achievements matter. Track your points and see your contributions recognized.</p>
              </div>
            </div>

            <div className="group flex gap-5 p-6 bg-white rounded-xl border border-gray-200 hover:border-primary/50 hover:shadow-lg transition-all">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/30 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Flexible Delivery</h3>
                <p className="text-gray-600">Choose delivery or pickup options that work best for your schedule and location.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden bg-primary py-20">
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-6">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-semibold text-white">Get Started Today</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 leading-tight">
            Ready to Unlock <br className="hidden sm:block" />Your Rewards?
          </h2>
          <p className="text-xl text-white/95 mb-10 max-w-2xl mx-auto leading-relaxed">
            Join your colleagues and start redeeming your points for company merchandise today.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/request-access">
              <Button 
                variant="secondary" 
                size="lg"
                className="shadow-2xl hover:shadow-3xl hover:scale-105 transition-all"
              >
                Request Access Now →
              </Button>
            </Link>
            <Link href="/login">
              <Button 
                variant="outline" 
                size="lg"
                className="bg-white/10 backdrop-blur-sm text-white border-2 border-white/50 hover:bg-white/20 hover:border-white"
              >
                Already have access?
              </Button>
            </Link>
          </div>
          
          <p className="mt-8 text-sm text-white/80">
            Questions? Contact our support team for assistance.
          </p>
        </div>
      </section>
    </div>
    </>
  );
}
