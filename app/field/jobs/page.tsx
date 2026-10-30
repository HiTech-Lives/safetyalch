import FieldNavHeader from '@/components/FieldNavHeader';
import FieldBackofficeClient from '@/components/FieldBackofficeClient';
import { getSession } from '@/lib/session';
import {
  getTenant,
  listWorkJobs,
  listEngagements,
  listMembers,
  listTimesheetsAndExpenses,
} from '@/lib/queries';
import { guardAccent } from '@/lib/color';

export const dynamic = 'force-dynamic';

export default async function FieldJobsAndTimePage() {
  const s = await getSession();
  const [tenant, jobs, engagements, members, { timesheets, expenses }] = await Promise.all([
    getTenant(s),
    listWorkJobs(s),
    listEngagements(s),
    listMembers(s),
    listTimesheetsAndExpenses(s),
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
        <FieldBackofficeClient
          jobs={jobs}
          engagements={engagements}
          members={members}
          expenses={expenses}
          timesheets={timesheets}
          userName={s.user.name}
        />
      </main>
    </div>
  );
}

