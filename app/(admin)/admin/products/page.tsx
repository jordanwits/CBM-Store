import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { Button } from 'core/components/Button';
import Link from 'next/link';
import ConversionRateEditor from './ConversionRateEditor';
import { ProductRowActions } from './ProductRowActions';
import { getStoreSettings } from '@/lib/cache/store-data';

// Cache admin products page for 2 minutes (admins might make frequent changes)
export const revalidate = 120;

export default async function AdminProductsPage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let conversionRate = 100;
  let products: any[] = [];
  
  if (!isDevMode) {
    const supabase = await createClient();

    // Run both queries in parallel for faster loading
    const [settings, productsResult] = await Promise.all([
      getStoreSettings(),
      supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    conversionRate = settings.conversionRate;
    products = productsResult.data || [];
  } else {
    // Mock data for dev mode
    products = [
      {
        id: '1',
        name: 'Company Logo T-Shirt',
        description: 'Premium cotton t-shirt',
        base_usd: 25.00,
        active: true,
      },
      {
        id: '2',
        name: 'Insulated Water Bottle',
        description: 'Stainless steel bottle',
        base_usd: 35.00,
        active: true,
      },
    ];
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-1">Manage products and conversion rates</p>
        </div>
        <Link href="/admin/products/new" className="shrink-0">
          <Button variant="primary" disabled={isDevMode}>
            Add Product
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Store Settings</h2>
          </div>
        </CardHeader>
        <CardContent>
          <ConversionRateEditor 
            currentRate={conversionRate} 
            isDevMode={isDevMode} 
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">All Products</h2>
        </CardHeader>
        <CardContent>
          {products && products.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Name
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Base USD
                    </th>
                    <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Points
                    </th>
                    <th className="hidden sm:table-cell px-3 py-2 md:px-4 md:py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Status
                    </th>
                    <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => {
                    const points = Math.round(product.base_usd * conversionRate);
                    return (
                      <tr key={product.id}>
                        <td className="px-3 py-2 md:px-4 md:py-3">
                          <p className="text-sm font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-700 line-clamp-1">{product.description}</p>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-900">${Number(product.base_usd).toFixed(2)}</td>
                        <td className="px-3 py-2 md:px-4 md:py-3 text-sm font-semibold text-gray-900">{points}</td>
                        <td className="hidden sm:table-cell px-3 py-2 md:px-4 md:py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              product.active
                                ? 'bg-green-100 text-green-900'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            {product.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-2 md:px-4 md:py-3 text-sm">
                          <ProductRowActions 
                            productId={product.id}
                            productName={product.name}
                            isActive={product.active}
                            isDevMode={isDevMode}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-700 text-center py-8">
              {isDevMode ? 'Mock products shown (configure Supabase to see real data)' : 'No products found'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

