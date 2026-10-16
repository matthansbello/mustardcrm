import { redirect } from 'next/navigation';

/** No landing page — send everyone straight into the app (middleware routes signed-out users to /login). */
export default function RootPage() {
  redirect('/dashboard');
}
