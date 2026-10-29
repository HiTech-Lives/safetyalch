import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import InviteForm from '@/components/InviteForm';
import TeamManager from '@/components/TeamManager';
import { getSession, can } from '@/lib/session';
import { listTeam, seatUsage, listSeatRequests } from '@/lib/queries';

export default async function TeamPage() {
  const s = await getSession();
  if (!can.manageTeam(s)) redirect('/today');
  const [team, seats, seatRequests] = await Promise.all([listTeam(s), seatUsage(s), listSeatRequests(s)]);
  const cells = [
    ['Paid seats', seats.paid + ' / ' + seats.purchased, seats.free > 0 ? seats.free + ' free to fill' : 'All seats in use'],
    ['Owners', (seats.by.owner ?? 0) + ' / 2', 'Maximum of two. Owners hold a paid seat.'],
    ['Admins', seats.by.admin ?? 0, 'Free. Console only, cannot inspect.'],
    ['In the field', (seats.by.supervisor ?? 0) + (seats.by.consultant ?? 0), 'Supervisors and Consultants'],
  ];
  return (
    <>
      <PageHeader title="Team" subtitle="Owners and Admins manage people; only an Owner spends money" />
      <div className="content" style={{ maxWidth: 1120 }}>
        <div className="stats">
          {cells.map(([k, v, h]) => (
            <div key={String(k)} className="frame stat"><div className="kicker">{k}</div><div className="v" style={{ fontSize: 28 }}>{v}</div><div className="h">{h}</div></div>
          ))}
        </div>
        <div className="tbl-wrap">
          <TeamManager team={team} seatRequests={seatRequests} viewerRole={s.role} />
          <InviteForm role={s.role} free={seats.free} ownerSlots={2 - (seats.by.owner ?? 0)} />
        </div>
      </div>
    </>
  );
}
