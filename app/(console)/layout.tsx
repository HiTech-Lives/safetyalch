import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import {
  getOptionalSession,
  getOptionalPlatformSession,
  isDemoModeEnabled,
} from '@/lib/session';
import { getTenant, listRecs, listUserWorkspaces } from '@/lib/queries';
import { guardAccent } from '@/lib/color';
import { recState, initials } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const [s, ps] = await Promise.all([getOptionalSession(), getOptionalPlatformSession()]);
  if (!s && !ps) {
    redirect('/login');
  }

  // Platform-Only Operator Mode (no tenant membership — operates /platform, /forms, /regulations)
  if (!s && ps) {
    const workspaces = await listUserWorkspaces(ps.user.email);
    return (
      <div className="shell" style={{ ['--acc' as string]: '#241f1c' }}>
        <Sidebar
          tenantId="__platform__"
          tenantName="SaaS Control Plane"
          tenantLogo="/brand/logo.png"
          workspaces={workspaces}
          role="admin"
          platformOnlyRole={ps.role}
          isPlatformAdmin={true}
          canManageTeam={false}
          canManageBrand={false}
          canManageTaxonomy={false}
          canSeeBilling={false}
          impersonation={null}
          user={{ name: ps.user.name, email: ps.user.email, ini: initials(ps.user.name) }}
          overdue={0}
          demoSwitch={isDemoModeEnabled()}
        />
        <div className="main">{children}</div>
      </div>
    );
  }

  const teamSess = s!;
  const [tenant, recs, workspaces] = await Promise.all([
    getTenant(teamSess),
    listRecs(teamSess),
    listUserWorkspaces(ps?.user.email || teamSess.user.email),
  ]);
  const overdue = recs.filter(r => recState(r.status, r.due_on) === 'overdue').length;
  const accent = tenant.brand_scopes?.app ? guardAccent(tenant.accent) : '#4b2454';

  return (
    <div className="shell" style={{ ['--acc' as string]: accent }}>
      <Sidebar
        tenantId={tenant.id}
        tenantName={tenant.name}
        tenantLogo={tenant.logo_key || '/brand/logo.png'}
        workspaces={workspaces}
        role={teamSess.role}
        platformOnlyRole={null}
        isPlatformAdmin={teamSess.isPlatformAdmin}
        canManageTeam={teamSess.permissions.has('team:users.manage')}
        canManageBrand={teamSess.permissions.has('team:brand.manage')}
        canManageTaxonomy={teamSess.permissions.has('team:taxonomy.manage')}
        canSeeBilling={teamSess.permissions.has('team:billing.view')}
        impersonation={teamSess.impersonation}
        user={{ name: teamSess.user.name, email: teamSess.user.email, ini: initials(teamSess.user.name) }}
        overdue={overdue}
        demoSwitch={isDemoModeEnabled()}
      />
      <div className="main">{children}</div>
    </div>
  );
}
