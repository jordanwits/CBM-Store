import { PageHeader } from 'core/components/PageHeader';
import { BackButton } from 'core/components/BackButton';
import { ProductForm } from '../ProductForm';

export default async function NewProductPage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  return (
    <div>
      <div className="mb-6">
        <BackButton href="/admin/products" label="Back to Products" />
      </div>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Add New Product</h1>
        <p className="text-gray-600 mt-1">Create a new product for your store</p>
      </div>

      <ProductForm mode="create" isDevMode={isDevMode} />
    </div>
  );
}

