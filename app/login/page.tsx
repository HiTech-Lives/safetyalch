import LoginClient from '@/components/LoginClient';
import { isDemoModeEnabled } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  return <LoginClient demoMode={isDemoModeEnabled()} nextPath={sp.next || null} />;
}
