import Link from 'next/link';
import { PageHeader, Frame } from '@/components/ui';
import PlatformManager from '@/components/PlatformManager';
import { getPlatformSession, getOptionalSession } from '@/lib/session';
import { listAllTenants, listForms, listRegs, listIndustryCatalog } from '@/lib/queries';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function PlatformSuperAdminPage() {
  // Strictly authenticate against Plane 1 (platform_sessions / sa_plat_session)
  const [ps, teamSess] = await Promise.all([getPlatformSession(), getOptionalSession()]);

  const [tenants, forms, regs, industries, platformUsers, aclRows, allTenantUsers, auditRows] = await Promise.all([
    listAllTenants(),
    listForms(),
    listRegs(),
    listIndustryCatalog(null),
    q<any>('SELECT id, name, email, role, status, created_at FROM platform_users ORDER BY created_at, id'),
    q<{ platform_user_id: string; permission_key: string; effect: 'allow' | 'deny' }>(
      'SELECT platform_user_id, permission_key, effect FROM platform_user_acl'
    ),
    q<any>(
      `SELECT u.id, u.tenant_id, u.name, u.email, u.role, u.status,
              u.is_platform_admin, u.is_complimentary_seat, u.created_at,
              t.name AS tenant_name, t.accent AS tenant_accent, t.status AS tenant_status
         FROM users u
         JOIN tenants t ON t.id = u.tenant_id
        ORDER BY t.name, FIELD(u.role,'owner','admin','supervisor','consultant','underwriting','viewer'), u.name`
    ),
    ps.permissions.has('platform:audit.view')
      ? q<any>(
          `SELECT pal.*, pu.name AS actor_name, pu.email AS actor_email
             FROM platform_audit_log pal
             LEFT JOIN platform_users pu ON pu.id = pal.actor_platform_user_id
            ORDER BY pal.at DESC LIMIT 60`
        )
      : Promise.resolve([]),
  ]);

  const operatorsWithAcl = platformUsers.map((pu: any) => ({
    ...pu,
    acl_overrides: aclRows.filter(a => a.platform_user_id === pu.id),
    linked_memberships: allTenantUsers.filter(
      (tu: any) => String(tu.email).toLowerCase() === String(pu.email).toLowerCase()
    ),
  }));

  const uniqueEmails = new Set<string>([
    ...platformUsers.map((pu: any) => String(pu.email).toLowerCase()),
    ...allTenantUsers.map((tu: any) => String(tu.email).toLowerCase()),
  ]);

  const totalSeats = tenants.reduce((a, t) => a + Number(t.seats_purchased), 0);
  const usedSeats = tenants.reduce((a, t) => a + Number(t.paid_seats_used), 0);
  const totalMembers = tenants.reduce((a, t) => a + Number(t.member_count), 0);
  const totalInspections = tenants.reduce((a, t) => a + Number(t.inspection_count), 0);
  const masterForms = forms.filter((f: any) => !f.tenant_id);
  const globalIndustries = industries.filter((i: any) => !i.tenant_id);

  return (
    <>
      <PageHeader
        title="Platform Control Plane"
        subtitle={`Authenticated as ${ps.user.name} (${ps.role}) · Global Identity Directory, Platform Operator ACLs, Tenant Provisioning & Master Taxonomies`}
      />
      <div className="content">
        <div className="stats">
          <div className="frame stat">
            <div className="kicker">Active Tenants</div>
            <div className="v">{tenants.length}</div>
            <div className="h">consultancies &amp; captives</div>
          </div>
          <div className="frame stat">
            <div className="kicker">Platform Licensed Seats</div>
            <div className="v">{usedSeats} / {totalSeats}</div>
            <div className="h">paid seats (attached ops = $0)</div>
          </div>
          <div className="frame stat">
            <div className="kicker">Global Identities</div>
            <div className="v">{uniqueEmails.size}</div>
            <div className="h">{operatorsWithAcl.length} platform ops · {allTenantUsers.length} team seats</div>
          </div>
          <div className="frame stat">
            <div className="kicker">Master Compliance Library</div>
            <div className="v">{masterForms.length}</div>
            <div className="h">{globalIndustries.length} industry lines · {regs.length} citations</div>
          </div>
        </div>

        <PlatformManager
          tenants={tenants}
          activeTenantId={teamSess?.tenantId || ''}
          currentOperatorId={ps.platformUserId}
          grantedPermissions={Array.from(ps.permissions)}
          operators={operatorsWithAcl}
          allTenantUsers={allTenantUsers}
          globalIndustries={globalIndustries}
          auditLog={auditRows}
        />

        <div className="cols">
          <Frame>
            <div className="panel-head">
              <h2>Master Forms &amp; Written Policies ({masterForms.length})</h2>
              <Link href="/forms">Open Master Builder →</Link>
            </div>
            <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--n7)', lineHeight: 1.55 }}>
              Platform Compliance Editors create and publish Master Inspection Checklists, CA/Fed Written Policy Gap Analyses (`GAP-IIPP`, `GAP-HEAT`, `GAP-HAZ`), and Captive Scorecards (`LCE-100`, `AUTO-SUP`, `RCA-JOB`) inherited by all workspaces ({totalMembers} client members · {totalInspections} inspections).
            </div>
          </Frame>
          <Frame>
            <div className="panel-head">
              <h2>56-Jurisdiction Regulation Engine ({regs.length})</h2>
              <Link href="/regulations">Open Regulation Engine →</Link>
            </div>
            <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--n7)', lineHeight: 1.55 }}>
              Manage all 56 US State/Territory OSHA plans + 6 Master Repositories with real-time `.gov` statutory live-fetch verification and immutable `regulations_never_edit` 7-year compliance triggers.
            </div>
          </Frame>
        </div>
      </div>
    </>
  );
}
