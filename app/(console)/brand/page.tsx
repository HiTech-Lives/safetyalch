import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import BrandForm from '@/components/BrandForm';
import { getSession, can } from '@/lib/session';
import { getTenant, listMembers } from '@/lib/queries';

export default async function BrandPage() {
  const s = await getSession();
  if (!can.manageBrand(s)) redirect('/today');
  const [t, members] = await Promise.all([getTenant(s), listMembers(s)]);
  const firstMemberId = members[0]?.id ?? 'demo-portal-m1';
  return (
    <>
      <PageHeader title="Brand & white-label" subtitle="One accent and logo re-skins the console, reports, emails and Member dashboard" />
      <div className="content">
        <BrandForm
          tenant={{
            name: t.name,
            domain: t.custom_domain ?? '',
            sender: t.email_sender ?? '',
            accent: t.accent,
            logo: t.logo_key ?? '',
            scopes: t.brand_scopes,
          }}
          portalPreviewHref={`/portal/${firstMemberId}`}
        />
      </div>
    </>
  );
}
