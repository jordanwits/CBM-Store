import { redirect } from 'next/navigation';

// Root / is redirected to /home by middleware. Fallback if middleware doesn't run.
export default function RootPage() {
  redirect('/home');
}
