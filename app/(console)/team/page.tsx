import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import InviteForm from '@/components/InviteForm';
import TeamManager from '@/components/TeamManager';
import { getSession, can } from '@/lib/session';
import { listTeam, seatUsage, listSeatRequests, listTenantTaxonomy } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const s = await getSession();
  if (!can.manageTeam(s) && !can.manageAcl(s)) redirect('/today');
  const [team, seats, seatRequests, taxonomy] = await Promise.all([
    listTeam(s),
    seatUsage(s),
    listSeatRequests(s),
    listTenantTaxonomy(s.tenantId),
  ]);
  const cells = [
    ['Licensed seats', seats.paid + ' / ' + seats.purchased, seats.free > 0 ? seats.free + ' free to fill' : 'All paid seats in use'],
    ['Owners', (seats.by.owner ?? 0) + ' / 2', 'Maximum of two. Owners hold a paid seat & billing authority.'],
    ['Admins & Viewers', (seats.by.admin ?? 0) + (seats.by.viewer ?? 0), 'Complimentary ($0). Team Admins & Read-Only Viewers.'],
    ['Field & Underwriting', (seats.by.supervisor ?? 0) + (seats.by.consultant ?? 0) + (seats.by.underwriting ?? 0), 'Supervisors, Consultants & Underwriting Analysts'],
  ];
  return (
    <>
      <PageHeader
        title="Team, Roles & User ACLs"
        subtitle={`Workspace user management, granular 14-permission ACL overrides, and ${taxonomy.groupLabel} scoping (strictly separated from SaaS Platform Operators)`}
      />
      <div className="content" style={{ maxWidth: 1180 }}>
        <div className="stats">
          {cells.map(([k, v, h]) => (
            <div key={String(k)} className="frame stat">
              <div className="kicker">{k}</div>
              <div className="v" style={{ fontSize: 28 }}>{v}</div>
              <div className="h">{h}</div>
            </div>
          ))}
        </div>
        <div className="tbl-wrap">
          <TeamManager
            team={team}
            seatRequests={seatRequests}
            taxonomy={taxonomy}
            viewerRole={s.role}
            canManageTeam={can.manageTeam(s)}
            canManageAcl={can.manageAcl(s)}
            canInviteAdmin={can.inviteAdmin(s)}
            canSpendMoney={can.spendMoney(s)}
          />
          {can.manageTeam(s) && (
            <InviteForm
              role={s.role}
              canInviteAdmin={can.inviteAdmin(s)}
              canSpendMoney={can.spendMoney(s)}
              free={seats.free}
              ownerSlots={2 - (seats.by.owner ?? 0)}
            />
          )}
        </div>
      </div>
    </>
  );
}
