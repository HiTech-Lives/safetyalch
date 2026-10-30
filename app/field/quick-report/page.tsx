import FieldNavHeader from '@/components/FieldNavHeader';
import QuickReportClient from '@/components/QuickReportClient';
import { getSession } from '@/lib/session';
import {
  getTenant,
  listMembers,
  listWorkJobs,
  listObservations,
  listQuickReports,
} from '@/lib/queries';
import { guardAccent } from '@/lib/color';

export const dynamic = 'force-dynamic';

export default async function FieldQuickReportPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; site?: string; job?: string }>;
}) {
  const s = await getSession();
  const sp = await searchParams;
  const [tenant, members, jobs, observations, existingReports] = await Promise.all([
    getTenant(s),
    listMembers(s),
    listWorkJobs(s),
    listObservations(s),
    listQuickReports(s),
  ]);
  const accent = tenant.brand_scopes?.app ? guardAccent(tenant.accent) : '#4b2454';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', ['--acc' as string]: accent }}>
      <FieldNavHeader
        tenantName={tenant.name}
        logoUrl={tenant.logo_key || '/brand/logo.png'}
        userName={s.user.name}
        role={s.role}
      />
      <main style={{ flex: 1, maxWidth: 1120, width: '100%', margin: '0 auto', padding: '26px 24px 56px' }}>
        <QuickReportClient
          members={members}
          jobs={jobs}
          observations={observations}
          existingReports={existingReports}
          userName={s.user.name}
          initialMemberId={sp.member}
          initialSiteId={sp.site}
          initialJobId={sp.job}
        />
      </main>
    </div>
  );
}

