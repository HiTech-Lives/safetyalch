'use client';
import { useMemo, useState } from 'react';
import { Pill } from './ui';
import RecDrawer from './RecDrawer';
import type { RecRow } from '@/lib/queries';
import { STATE_LABEL, PRIORITY_DAYS, fmtShort, shortName, type RecState } from '@/lib/format';

type Rec = RecRow & { state: RecState };
const TABS: [string, (r: Rec) => boolean][] = [
  ['Open', r => r.status === 'open'],
  ['Overdue', r => r.state === 'overdue'],
  ['Pending review', r => r.state === 'pending'],
  ['Corrected', r => r.state === 'corrected'],
  ['Risk assumed', r => r.state === 'assumed'],
  ['All', () => true],
];

export default function RecBoard({ recs, initialTab, initialOpen, initialMember }: { recs: Rec[]; initialTab: string; initialOpen: string | null; initialMember: string | null }) {
  const [tab, setTab] = useState(TABS.some(t => t[0] === initialTab) ? initialTab : 'Open');
  const [open, setOpen] = useState<string | null>(initialOpen);
  const [member, setMember] = useState<string | null>(initialMember);
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const f = TABS.find(t => t[0] === tab)![1];
    const needle = q.toLowerCase();
    return recs
      .filter(f)
      .filter(r => !member || r.member_id === member)
      .filter(r => !needle || (r.id + ' ' + r.text + ' ' + r.member + ' ' + r.site + ' ' + r.consultant).toLowerCase().includes(needle));
  }, [recs, tab, member, q]);

  const memberName = member ? recs.find(r => r.member_id === member)?.member : null;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div className="tabs" role="tablist">
          {TABS.map(([label, f]) => (
            <button key={label} role="tab" aria-selected={tab === label} className={'tab' + (tab === label ? ' on' : '')} onClick={() => setTab(label)}>
              {label}<span className="c">{recs.filter(f).length}</span>
            </button>
          ))}
        </div>
        <label className="search" style={{ marginLeft: 'auto' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--n6)" strokeWidth="1.5"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search recommendations" />
        </label>
      </div>
      {memberName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <Pill kind="solid">Member</Pill>{memberName}
          <button onClick={() => setMember(null)} style={{ border: 'none', background: 'none', color: 'var(--a7)', textDecoration: 'underline', cursor: 'pointer' }}>Clear</button>
        </div>
      )}
      <div className="tbl-wrap">
        <table className="tbl" style={{ minWidth: 900 }}>
          <thead><tr><th>No.</th><th>Recommendation</th><th>Member · site</th><th>Priority</th><th>Due</th><th>Consultant</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="click" onClick={() => setOpen(r.id)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && setOpen(r.id)}>
                <td className="code">{r.id}</td>
                <td style={{ lineHeight: 1.4, minWidth: 280 }}>{r.text}</td>
                <td>{r.member}<span className="sub">{r.site} · {r.jurisdiction}</span></td>
                <td className="kicker" style={{ color: 'var(--ink)' }}>{r.priority} · {PRIORITY_DAYS[r.priority]}d</td>
                <td className={r.state === 'overdue' ? 'overdue' : ''}>{fmtShort(r.due_on)}</td>
                <td>{shortName(r.consultant)}</td>
                <td><Pill kind={r.state}>{STATE_LABEL[r.state]}</Pill></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} style={{ color: 'var(--n6)' }}>No recommendations match.</td></tr>}
          </tbody>
        </table>
      </div>
      {open && <RecDrawer id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
