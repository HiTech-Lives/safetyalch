import Sidebar from '@/components/Sidebar';
import { getSession } from '@/lib/session';
import { getTenant, listRecs, listAllTenants } from '@/lib/queries';
import { guardAccent } from '@/lib/color';
import { recState, initials } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const [tenant, recs, allTenants] = await Promise.all([
    getTenant(s),
    listRecs(s),
    listAllTenants(),
  ]);
  const overdue = recs.filter(r => recState(r.status, r.due_on) === 'overdue').length;
  const accent = tenant.brand_scopes.app ? guardAccent(tenant.accent) : '#4b2454';
  return (
    <div className="shell" style={{ ['--acc' as string]: accent }}>
      <Sidebar
        tenantId={tenant.id}
        tenantName={tenant.name}
        tenantLogo={tenant.logo_key || '/brand/logo.png'}
        tenants={allTenants.map(t => ({ id: t.id, name: t.name }))}
        role={s.role}
        isPlatformAdmin={s.isPlatformAdmin}
        user={{ name: s.user.name, ini: initials(s.user.name) }}
        overdue={overdue}
        demoSwitch={process.env.DEMO_ROLE_SWITCH === 'true'}
      />
      <div className="main">{children}</div>
    </div>
  );
}
