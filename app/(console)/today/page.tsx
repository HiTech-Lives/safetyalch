import Link from 'next/link';
import { PageHeader, Frame, Pill } from '@/components/ui';
import { getSession } from '@/lib/session';
import { listRecs, listVisits, listMembers } from '@/lib/queries';
import { recState, STATE_LABEL, fmtDate, fmtShort, fmtDay, todayISO, daysBetween, shortName } from '@/lib/format';

export default async function TodayPage() {
  const s = await getSession();
  const [recs, visits, members] = await Promise.all([listRecs(s), listVisits(s, 5), listMembers(s)]);
  const today = todayISO();
  const withState = recs.map(r => ({ ...r, state: recState(r.status, r.due_on) }));
  const count = (k: string) => withState.filter(r => (k === 'open' ? r.status === 'open' : r.state === k)).length;
  const dueSoon = withState.filter(r => r.state === 'open' && daysBetween(today, r.due_on) <= 7).length;
  const attention = withState.filter(r => r.state === 'overdue' || r.state === 'pending').slice(0, 7);
  const unassigned = s.role === 'supervisor' ? [] : members.filter(m => m.team.length === 0);

  const stats = [
    { k: 'Open', v: count('open'), h: 'recommendations', tab: 'Open' },
    { k: 'Overdue', v: count('overdue'), h: 'past their due date', tab: 'Overdue', bad: true },
    { k: 'Pending review', v: count('pending'), h: 'Member says fixed', tab: 'Pending review' },
    { k: 'Due in 7 days', v: dueSoon, h: 'still open', tab: 'Open' },
  ];

  return (
    <>
      <PageHeader title="Today" subtitle={fmtDate(today) + ' · ' + s.user.name} />
      <div className="content">
        {unassigned.length > 0 && (
          <Link href="/members" className="banner warn">
            <Pill kind="unassigned">Unassigned</Pill>
            <span style={{ flex: 1 }}>
              {unassigned.length} Member{unassigned.length === 1 ? ' has' : 's have'} no Consultant assigned: {unassigned.map(m => m.name).join(', ')}.
            </span>
            <b>Assign →</b>
          </Link>
        )}
        <div className="stats">
          {stats.map(x => (
            <Frame as={Link} key={x.k} href={'/recommendations?tab=' + encodeURIComponent(x.tab)} className="stat">
              <div className="kicker">{x.k}</div>
              <div className="v" style={{ color: x.bad && x.v ? 'var(--bad)' : undefined }}>{x.v}</div>
              <div className="h">{x.h}</div>
            </Frame>
          ))}
        </div>
        <div className="cols">
          <Frame className="strong">
            <div className="panel-head"><h2>Needs attention</h2><Link href="/recommendations">All recommendations →</Link></div>
            {attention.length === 0 && <div style={{ padding: 18, fontSize: 13, color: 'var(--n6)' }}>Nothing overdue or waiting for review.</div>}
            {attention.map(r => (
              <Link key={r.id} href={'/recommendations?tab=All&open=' + r.id} className="row" style={{ display: 'grid', gridTemplateColumns: '62px minmax(0,1fr) auto', gap: 12 }}>
                <span className="code">{r.id}</span>
                <span>
                  <span style={{ display: 'block', fontSize: 13, lineHeight: 1.4 }}>{r.text}</span>
                  <span className="sub">{r.member} · {r.site} · due {fmtShort(r.due_on)}</span>
                </span>
                <Pill kind={r.state}>{STATE_LABEL[r.state]}</Pill>
              </Link>
            ))}
          </Frame>
          <Frame>
            <div className="panel-head"><h2>Coming up</h2><Link href="/schedule">Schedule →</Link></div>
            {visits.map(v => (
              <Link key={v.id} href="/schedule" className="row" style={{ display: 'grid', gridTemplateColumns: '54px minmax(0,1fr) auto', gap: 12, alignItems: 'center' }}>
                <span style={{ font: '700 15px/1.1 var(--fh)' }}>{fmtDay(v.scheduled_for)}</span>
                <span>
                  <span style={{ display: 'block', fontSize: 13 }}>{v.member} · {v.site}</span>
                  <span className="sub" style={!v.lead ? { color: 'var(--warn7)', fontWeight: 600 } : undefined}>
                    {v.form_code} · {v.lead ? shortName(v.lead) + (v.attendees ? ' +' + v.attendees : '') : 'UNASSIGNED'}
                  </span>
                </span>
                <span className="kicker">Manage →</span>
              </Link>
            ))}
          </Frame>
        </div>
      </div>
    </>
  );
}
