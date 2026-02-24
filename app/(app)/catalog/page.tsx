import { redirect } from 'next/navigation';

// Redirect /catalog to /dashboard (now the main storefront)
export default async function CatalogPage() {
  redirect('/dashboard');
}
