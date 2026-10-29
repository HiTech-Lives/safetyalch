import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import SeatButtons from '@/components/SeatButtons';
import { getSession, can } from '@/lib/session';
import { seatUsage, getTenant } from '@/lib/queries';

export default async function BillingPage() {
  const s = await getSession();
  if (!can.seeBilling(s)) redirect('/today');
  const [seats, t] = await Promise.all([seatUsage(s), getTenant(s)]);
  const rows: [string, string, number, string][] = [
    ['Owners', 'Maximum two. Can inspect.', seats.by.owner ?? 0, 'Paid seat'],
    ['Admins', 'Console only. No app access.', seats.by.admin ?? 0, 'Free'],
    ['Supervisors', 'Inspect and oversee a crew.', seats.by.supervisor ?? 0, 'Paid seat'],
    ['Consultants', 'Inspect assigned Members.', seats.by.consultant ?? 0, 'Paid seat'],
  ];
  return (
    <>
      <PageHeader title="Billing & seats" subtitle="You pay per person who can run an inspection" />
      <div className="content" style={{ maxWidth: 1000 }}>
        {!can.spendMoney(s) && <div className="banner dashed">Read only. Only an Owner can buy or remove seats, change the plan or see payment details.</div>}
        {!t.payment_provider && <div className="banner warn">Payment provider not connected. Seat changes are recorded and appear on the next invoice once a provider is chosen.</div>}
        <div className="frame strong">
          <div className="panel-head"><h2>Seats</h2></div>
          {rows.map(([role, rule, n, cost]) => (
            <div key={role} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 90px 120px', gap: 12, alignItems: 'center', padding: '12px 18px', borderTop: '1px solid var(--div2)', fontSize: 13 }}>
              <span><span style={{ fontWeight: 500 }}>{role}</span><span className="sub">{rule}</span></span>
              <span className="num" style={{ fontSize: 18 }}>{n}</span>
              <span className="kicker" style={{ color: 'var(--ink)', textAlign: 'right' }}>{cost}</span>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 90px 120px', gap: 12, alignItems: 'center', padding: '13px 18px', borderTop: '1px solid var(--ink)', fontSize: 13, fontWeight: 600 }}>
            <span>Paid seats in use</span>
            <span className="num" style={{ fontSize: 18 }}>{seats.paid} / {seats.purchased}</span>
            <span style={{ textAlign: 'right' }}>{seats.free > 0 ? seats.free + ' free' : 'None free'}</span>
          </div>
        </div>
        {can.spendMoney(s) && <SeatButtons free={seats.free} />}
      </div>
    </>
  );
}
