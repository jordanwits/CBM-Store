'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function updateConversionRate(newRate: number) {
  const { supabase, profile } = await requireAdmin();
  
  // Validate the rate
  if (isNaN(newRate) || newRate <= 0) {
    return { success: false, error: 'Conversion rate must be a positive number' };
  }
  
  // Update store_settings
  const { error } = await supabase
    .from('store_settings')
    .update({
      usd_to_points_rate: newRate,
      updated_by: profile.id,
    })
    .eq('id', 1);
  
  if (error) {
    console.error('Error updating conversion rate:', error);
    return { success: false, error: 'Failed to update conversion rate' };
  }
  
  // Revalidate cache tags and paths
  revalidateTag('store-settings');
  revalidatePath('/admin/products');
  revalidatePath('/dashboard');
  
  return { success: true };
}

interface ProductData {
  name: string;
  description: string;
  base_usd: number;
  category?: string;
  collections?: string[];
  images?: string[];
}

export async function createProduct(data: ProductData) {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Product creation requires Supabase to be configured.' 
    };
  }

  const { supabase } = await requireAdmin();
  
  // Validate required fields
  if (!data.name || !data.description || !data.base_usd || data.base_usd <= 0) {
    return { success: false, error: 'Name, description, and valid base price are required' };
  }
  
  const { data: product, error } = await supabase
    .from('products')
    .insert({
      name: data.name,
      description: data.description,
      base_usd: data.base_usd,
      category: data.category || null,
      collections: data.collections || [],
      images: data.images || [],
      active: true,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating product:', error);
    return { success: false, error: 'Failed to create product' };
  }
  
  // Revalidate cache tags and paths
  revalidateTag('products');
  revalidateTag('filter-metadata');
  revalidatePath('/admin/products');
  revalidatePath('/dashboard');
  
  return { success: true, productId: product.id };
}

export async function updateProduct(productId: string, data: ProductData) {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Product updates require Supabase to be configured.' 
    };
  }

  const { supabase } = await requireAdmin();
  
  // Validate required fields
  if (!data.name || !data.description || !data.base_usd || data.base_usd <= 0) {
    return { success: false, error: 'Name, description, and valid base price are required' };
  }
  
  const { error } = await supabase
    .from('products')
    .update({
      name: data.name,
      description: data.description,
      base_usd: data.base_usd,
      category: data.category || null,
      collections: data.collections || [],
      images: data.images || [],
    })
    .eq('id', productId);
  
  if (error) {
    console.error('Error updating product:', error);
    return { success: false, error: 'Failed to update product' };
  }
  
  // Revalidate relevant pages
  revalidatePath('/admin/products');
  revalidatePath('/dashboard');
  revalidatePath(`/product/${productId}`);
  
  return { success: true };
}

export async function setProductActive(productId: string, active: boolean) {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Product status updates require Supabase to be configured.' 
    };
  }

  const { supabase } = await requireAdmin();
  
  const { error } = await supabase
    .from('products')
    .update({ active })
    .eq('id', productId);
  
  if (error) {
    console.error('Error updating product status:', error);
    return { success: false, error: 'Failed to update product status' };
  }
  
  // Revalidate relevant pages
  revalidatePath('/admin/products');
  revalidatePath('/dashboard');
  revalidatePath(`/product/${productId}`);
  
  return { success: true };
}

interface VariantData {
  product_id: string;
  name: string;
  sku?: string;
  size?: string;
  color?: string;
  price_adjustment_usd?: number;
  inventory_count?: number;
  image_url?: string;
}

export async function createVariant(data: VariantData) {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Variant creation requires Supabase to be configured.' 
    };
  }

  const { supabase } = await requireAdmin();
  
  if (!data.product_id || !data.name) {
    return { success: false, error: 'Product ID and name are required' };
  }
  
  const { data: variant, error } = await supabase
    .from('product_variants')
    .insert({
      product_id: data.product_id,
      name: data.name,
      sku: data.sku || null,
      size: data.size || null,
      color: data.color || null,
      price_adjustment_usd: data.price_adjustment_usd || 0,
      inventory_count: data.inventory_count || null,
      image_url: data.image_url || null,
      active: true,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating variant:', error);
    return { success: false, error: 'Failed to create variant' };
  }
  
  // Revalidate cache tags and paths
  revalidateTag('product-variants');
  revalidateTag('filter-metadata');
  revalidatePath('/admin/products');
  revalidatePath('/dashboard');
  revalidatePath(`/product/${data.product_id}`);
  
  return { success: true, variantId: variant.id };
}

export async function updateVariant(variantId: string, data: Partial<VariantData>) {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Variant updates require Supabase to be configured.' 
    };
  }

  const { supabase } = await requireAdmin();
  
  const { error } = await supabase
    .from('product_variants')
    .update({
      ...(data.name && { name: data.name }),
      ...(data.sku !== undefined && { sku: data.sku || null }),
      ...(data.size !== undefined && { size: data.size || null }),
      ...(data.color !== undefined && { color: data.color || null }),
      ...(data.price_adjustment_usd !== undefined && { price_adjustment_usd: data.price_adjustment_usd }),
      ...(data.inventory_count !== undefined && { inventory_count: data.inventory_count }),
      ...(data.image_url !== undefined && { image_url: data.image_url || null }),
    })
    .eq('id', variantId);
  
  if (error) {
    console.error('Error updating variant:', error);
    return { success: false, error: 'Failed to update variant' };
  }
  
  // Get product_id for revalidation
  const { data: variant } = await supabase
    .from('product_variants')
    .select('product_id')
    .eq('id', variantId)
    .single();
  
  if (variant) {
    // Revalidate cache tags and paths
    revalidateTag('product-variants');
    revalidateTag('filter-metadata');
    revalidatePath('/admin/products');
    revalidatePath('/dashboard');
    revalidatePath(`/product/${variant.product_id}`);
  }
  
  return { success: true };
}

export async function setVariantActive(variantId: string, active: boolean) {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Variant status updates require Supabase to be configured.' 
    };
  }

  const { supabase } = await requireAdmin();
  
  const { error } = await supabase
    .from('product_variants')
    .update({ active })
    .eq('id', variantId);
  
  if (error) {
    console.error('Error updating variant status:', error);
    return { success: false, error: 'Failed to update variant status' };
  }
  
  // Get product_id for revalidation
  const { data: variant } = await supabase
    .from('product_variants')
    .select('product_id')
    .eq('id', variantId)
    .single();
  
  if (variant) {
    // Revalidate cache tags and paths
    revalidateTag('product-variants');
    revalidateTag('filter-metadata');
    revalidatePath('/admin/products');
    revalidatePath('/dashboard');
    revalidatePath(`/product/${variant.product_id}`);
  }
  
  return { success: true };
}

export async function deleteVariant(variantId: string) {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Variant deletion requires Supabase to be configured.' 
    };
  }

  const { supabase } = await requireAdmin();
  
  // Get product_id before deleting for revalidation
  const { data: variant } = await supabase
    .from('product_variants')
    .select('product_id')
    .eq('id', variantId)
    .single();
  
  const { error } = await supabase
    .from('product_variants')
    .delete()
    .eq('id', variantId);
  
  if (error) {
    console.error('Error deleting variant:', error);
    return { success: false, error: 'Failed to delete variant' };
  }
  
  if (variant) {
    // Revalidate cache tags and paths
    revalidateTag('product-variants');
    revalidateTag('filter-metadata');
    revalidatePath('/admin/products');
    revalidatePath('/dashboard');
    revalidatePath(`/product/${variant.product_id}`);
  }
  
  return { success: true };
}

export async function deleteProduct(productId: string) {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Product deletion requires Supabase to be configured.' 
    };
  }

  const { supabase } = await requireAdmin();
  
  // Check if product exists in any orders
  const { data: orderItems, error: checkError } = await supabase
    .from('order_items')
    .select('id')
    .eq('product_id', productId)
    .limit(1);
  
  if (checkError) {
    console.error('Error checking product orders:', checkError);
    return { success: false, error: 'Failed to check product usage' };
  }
  
  if (orderItems && orderItems.length > 0) {
    return { 
      success: false, 
      error: 'Cannot delete product that has been ordered. Consider deactivating it instead.' 
    };
  }
  
  // Delete the product (cascade will handle variants due to foreign key)
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);
  
  if (error) {
    console.error('Error deleting product:', error);
    return { success: false, error: 'Failed to delete product' };
  }
  
  // Revalidate cache tags and paths
  revalidateTag('products');
  revalidateTag('product-variants');
  revalidateTag('filter-metadata');
  revalidatePath('/admin/products');
  revalidatePath('/dashboard');
  
  return { success: true };
}

export async function uploadProductImage(formData: FormData) {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Image upload requires Supabase to be configured.' 
    };
  }

  const { supabase } = await requireAdmin();
  
  const file = formData.get('file') as File;
  
  if (!file) {
    return { success: false, error: 'No file provided' };
  }
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'File must be an image' };
  }
  
  // Validate file size (10MB max)
  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > maxSize) {
    return { success: false, error: 'File size must be less than 10MB' };
  }
  
  try {
    // Generate unique filename with timestamp and original extension
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}-${randomStr}.${fileExt}`;
    
    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('products')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });
    
    if (error) {
      console.error('Supabase storage upload error:', error);
      // Return more specific error message
      if (error.message.includes('not found')) {
        return { success: false, error: 'Storage bucket not found. Please run migration 011.' };
      }
      if (error.message.includes('policy')) {
        return { success: false, error: 'Permission denied. Please check storage RLS policies.' };
      }
      return { success: false, error: `Upload failed: ${error.message}` };
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('products')
      .getPublicUrl(fileName);
    
    return { success: true, url: publicUrlData.publicUrl };
  } catch (error) {
    console.error('Error processing image upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to process upload: ${errorMessage}` };
  }
}