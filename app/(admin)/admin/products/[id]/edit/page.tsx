import { createClient } from '@/lib/supabase/server';
import { BackButton } from 'core/components/BackButton';
import { ProductForm } from '../../ProductForm';
import { VariantManager } from '../../VariantManager';
import { notFound } from 'next/navigation';

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let product: any = null;
  let variants: any[] = [];
  
  if (!isDevMode) {
    const supabase = await createClient();
    
    const [productResult, variantsResult] = await Promise.all([
      supabase.from('products').select('*').eq('id', id).single(),
      supabase.from('product_variants').select('*').eq('product_id', id).order('created_at'),
    ]);
    
    product = productResult.data;
    variants = variantsResult.data || [];
    
    if (!product) {
      notFound();
    }
  } else {
    // Mock data for dev mode
    product = {
      id: id,
      name: 'Sample Product',
      description: 'This is a sample product in dev mode',
      base_usd: 25.00,
      category: 'Apparel',
      collections: ['New Arrivals'],
      images: ['/ChrisCrossBlackCottonT-Shirt.webp'],
    };
    variants = [];
  }

  return (
    <div>
      <div className="mb-6">
        <BackButton href="/admin/products" label="Back to Products" />
      </div>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Edit Product</h1>
        <p className="text-gray-600 mt-1">Update product information and manage variants</p>
      </div>

      <div className="space-y-6">
        <ProductForm 
          mode="edit" 
          productId={id}
          initialData={product}
          isDevMode={isDevMode} 
        />

        <VariantManager
          productId={id}
          initialVariants={variants}
          isDevMode={isDevMode}
          disabled={false}
        />
      </div>
    </div>
  );
}
