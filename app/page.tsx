import { redirect } from 'next/navigation';

// Redirect root to the marketing homepage which has the proper layout
export default function RootPage() {
  redirect('/home');
}
