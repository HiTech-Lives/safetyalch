import FieldNavHeader from '@/components/FieldNavHeader';
import FieldLauncherClient from '@/components/FieldLauncherClient';
import { getSession } from '@/lib/session';
import { listInspections, listVisits, listMembers, listForms, getTenant } from '@/lib/queries';
import { guardAccent } from '@/lib/color';

export const dynamic = 'force-dynamic';

export default async function FieldHomePage() {
  const s = await getSession();
  const [tenant, inspections, visits, members, forms] = await Promise.all([
    getTenant(s),
    listInspections(s),
    listVisits(s),
    listMembers(s),
    listForms(s.tenantId),
  ]);
  const inProgress = inspections.filter(i => !i.submitted_at);
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
        <FieldLauncherClient inProgress={inProgress} visits={visits} members={members} forms={forms} />
      </main>
    </div>
  );
}

