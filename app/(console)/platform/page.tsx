import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader, Frame } from '@/components/ui';
import PlatformManager from '@/components/PlatformManager';
import { getSession, can } from '@/lib/session';
import { listAllTenants, listForms, listRegs } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function PlatformSuperAdminPage() {
  const s = await getSession();
  if (!can.platformAdmin(s)) redirect('/today');

  const [tenants, forms, regs] = await Promise.all([listAllTenants(), listForms(), listRegs()]);
  const totalSeats = tenants.reduce((a, t) => a + Number(t.seats_purchased), 0);
  const usedSeats = tenants.reduce((a, t) => a + Number(t.paid_seats_used), 0);
  const totalMembers = tenants.reduce((a, t) => a + Number(t.member_count), 0);
  const totalInspections = tenants.reduce((a, t) => a + Number(t.inspection_count), 0);
  const masterForms = forms.filter((f: any) => !f.tenant_id);

  return (
    <>
      <PageHeader
        title="Platform Super-Admin"
        subtitle="Multi-tenant SaaS operations · tenant provisioning, seat utilization & master compliance library"
      />
      <div className="content">
        <div className="stats">
          <div className="frame stat">
            <div className="kicker">Active Tenants</div>
            <div className="v">{tenants.length}</div>
            <div className="h">consultancies &amp; captives</div>
          </div>
          <div className="frame stat">
            <div className="kicker">Platform Paid Seats</div>
            <div className="v">{usedSeats} / {totalSeats}</div>
            <div className="h">active field inspectors</div>
          </div>
          <div className="frame stat">
            <div className="kicker">Client Members</div>
            <div className="v">{totalMembers}</div>
            <div className="h">{totalInspections} inspections on file</div>
          </div>
          <div className="frame stat">
            <div className="kicker">Master Library</div>
            <div className="v">{masterForms.length}</div>
            <div className="h">master forms · {regs.length} regulations</div>
          </div>
        </div>

        <PlatformManager tenants={tenants} activeTenantId={s.tenantId} />

        <div className="cols">
          <Frame>
            <div className="panel-head">
              <h2>Master Form Templates ({masterForms.length})</h2>
              <Link href="/forms">Manage Forms →</Link>
            </div>
            <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--n7)', lineHeight: 1.55 }}>
              All tenants inherit the 15 standardized master forms (903 calibrated questions). Tenants can also clone any master form into a tenant-scoped template without affecting other organizations.
            </div>
          </Frame>
          <Frame>
            <div className="panel-head">
              <h2>Global Regulation Library ({regs.length})</h2>
              <Link href="/regulations">Manage Citations →</Link>
            </div>
            <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--n7)', lineHeight: 1.55 }}>
              Verified regulation citations are protected by MySQL 8 immutability triggers (`regulations_never_edit` and `regulations_never_delete`) to guarantee 7-year citation integrity across all tenants.
            </div>
          </Frame>
        </div>
      </div>
    </>
  );
}

