import Link from 'next/link';
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
      <header style={{ background: 'var(--ink)', color: '#fff', padding: '14px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={tenant.logo_key || '/brand/logo.png'} alt={tenant.name} style={{ height: 28, filter: 'brightness(0) invert(1)' }} />
          <div>
            <div style={{ font: '700 17px var(--fh)', letterSpacing: '.05em', textTransform: 'uppercase' }}>{tenant.name} · Field Inspector PWA</div>
            <div className="kicker" style={{ color: 'rgba(255,255,255,.55)' }}>Inspector: {s.user.name} ({s.role})</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/today" className="btn btn-sm" style={{ background: 'transparent', borderColor: 'rgba(255,255,255,.35)', color: '#fff' }}>
            ← Back to Staff Console
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 1120, width: '100%', margin: '0 auto', padding: '26px 24px 56px' }}>
        <FieldLauncherClient inProgress={inProgress} visits={visits} members={members} forms={forms} />
      </main>
    </div>
  );
}

