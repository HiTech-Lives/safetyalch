'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from './ui';
import { fmtDay, todayISO, daysBetween, shortName } from '@/lib/format';

export default function ScheduleManager({
  visits,
  members,
  forms,
  fieldStaff,
  currentUserId,
  role,
}: {
  visits: any[];
  members: any[];
  forms: any[];
  fieldStaff: any[];
  currentUserId: string;
  role: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Flatten member sites
  const allSites = members.flatMap(m =>
    m.sites.map((st: any) => ({
      siteId: st.id,
      label: `${m.name} · ${st.name} (${st.jurisdiction})`,
      memberName: m.name,
      siteName: st.name,
    }))
  );

  // Create form state
  const [siteId, setSiteId] = useState<number>(allSites[0]?.siteId ?? 0);
  const [formCode, setFormCode] = useState<string>(forms[0]?.code ?? 'GEN');
  const [scheduledFor, setScheduledFor] = useState<string>(todayISO());
  const [leadUserId, setLeadUserId] = useState<string>(role === 'consultant' ? currentUserId : (fieldStaff[0]?.id ?? ''));
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);

  // Edit drawer state
  const [openVisit, setOpenVisit] = useState<any | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editForm, setEditForm] = useState('');
  const [editLead, setEditLead] = useState('');
  const [editAttendees, setEditAttendees] = useState<string[]>([]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  function selectVisit(v: any) {
    setOpenVisit(v);
    setEditDate(v.scheduled_for);
    setEditForm(v.form_code);
    setEditLead(v.lead_user_id ?? '');
    setEditAttendees(v.attendee_ids ? String(v.attendee_ids).split(',').filter(Boolean) : []);
  }

  async function createVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId || !formCode || !scheduledFor) return;
    setBusy(true);
    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        siteId,
        formCode,
        scheduledFor,
        leadUserId: leadUserId || null,
        attendeeIds: attendeeIds.filter(id => id !== leadUserId),
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setAttendeeIds([]);
      router.refresh();
    }
  }

  async function saveVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!openVisit) return;
    setBusy(true);
    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        visitId: openVisit.id,
        scheduledFor: editDate,
        formCode: editForm,
        leadUserId: editLead || null,
        attendeeIds: editAttendees.filter(id => id !== editLead),
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setOpenVisit(null);
      router.refresh();
    }
  }

  async function cancelVisit() {
    if (!openVisit) return;
    setBusy(true);
    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete', visitId: openVisit.id }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setOpenVisit(null);
      router.refresh();
    }
  }

  const today = todayISO();
  const dow = new Date().getDay();
  const toWeekEnd = 7 - dow;
  const groups: [string, any[]][] = [
    ['This week', visits.filter(v => daysBetween(today, v.scheduled_for) < toWeekEnd)],
    ['Next week', visits.filter(v => { const d = daysBetween(today, v.scheduled_for); return d >= toWeekEnd && d < toWeekEnd + 7; })],
    ['Later', visits.filter(v => daysBetween(today, v.scheduled_for) >= toWeekEnd + 7)],
  ];

  return (
    <>
      <div className="detail">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          {groups.filter(g => g[1].length).map(([label, items]) => (
            <section key={label}>
              <div style={{ font: '600 12px var(--fh)', letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--n7)', marginBottom: 8 }}>{label}</div>
              <div className="frame">
                {items.map(v => (
                  <div
                    key={v.id}
                    className="row"
                    onClick={() => selectVisit(v)}
                    style={{ display: 'grid', gridTemplateColumns: '86px minmax(0,1fr) auto', gap: 14, alignItems: 'center' }}
                  >
                    <span style={{ font: '700 15px/1.1 var(--fh)' }}>{fmtDay(v.scheduled_for)}</span>
                    <span>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}>{v.member} · {v.site}</span>
                      <span className="sub">{v.form_name} · {v.jurisdiction}</span>
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      {v.lead ? <span style={{ fontSize: 13, fontWeight: 500 }}>{shortName(v.lead)}{v.attendees ? ' +' + v.attendees : ''}</span> : <Pill kind="unassigned">Unassigned</Pill>}
                      <span className="kicker">{!v.lead ? 'click to assign' : v.origin === 'self' ? 'self-scheduled' : 'assigned by ' + shortName(v.created_by_name)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {visits.length === 0 && (
            <div className="frame" style={{ padding: 20, color: 'var(--n6)', fontSize: 13 }}>No visits scheduled.</div>
          )}
        </div>

        <Frame>
          <div className="panel-head"><h2>Schedule a visit</h2></div>
          <form onSubmit={createVisit} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label className="field">
              <span>Member &amp; Site</span>
              <select className="select" value={siteId} onChange={e => setSiteId(Number(e.target.value))} required>
                {allSites.map(s => <option key={s.siteId} value={s.siteId}>{s.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Inspection Form</span>
              <select className="select" value={formCode} onChange={e => setFormCode(e.target.value)} required>
                {forms.map(f => <option key={f.code} value={f.code}>{f.code} · {f.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Date</span>
              <input className="input" type="date" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} required />
            </label>
            <label className="field">
              <span>Lead Consultant</span>
              <select
                className="select"
                value={leadUserId}
                onChange={e => setLeadUserId(e.target.value)}
                disabled={role === 'consultant'}
              >
                {role !== 'consultant' && <option value="">— Leave unassigned —</option>}
                {fieldStaff.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </label>
            {leadUserId && fieldStaff.filter(u => u.id !== leadUserId).length > 0 && (
              <div className="field">
                <span>Shared-visit attendees (optional)</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                  {fieldStaff.filter(u => u.id !== leadUserId).map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                      <input
                        type="checkbox"
                        checked={attendeeIds.includes(u.id)}
                        onChange={e => setAttendeeIds(prev => e.target.checked ? [...prev, u.id] : prev.filter(x => x !== u.id))}
                      />
                      <span>{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy || !siteId}>
              Schedule visit
            </button>
          </form>
        </Frame>
      </div>

      {openVisit && (
        <>
          <div className="drawer-bg" onClick={() => setOpenVisit(null)} />
          <aside className="drawer" role="dialog" aria-label="Manage visit">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Visit #{openVisit.id} · {openVisit.jurisdiction}</div>
                <h2>{openVisit.member} · {openVisit.site}</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setOpenVisit(null)} aria-label="Close">×</button>
            </div>
            <form onSubmit={saveVisit} className="drawer-body">
              <label className="field">
                <span>Scheduled date</span>
                <input className="input" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} required />
              </label>
              <label className="field">
                <span>Inspection Form</span>
                <select className="select" value={editForm} onChange={e => setEditForm(e.target.value)}>
                  {forms.map(f => <option key={f.code} value={f.code}>{f.code} · {f.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Lead Consultant</span>
                <select className="select" value={editLead} onChange={e => setEditLead(e.target.value)} disabled={role === 'consultant'}>
                  <option value="">— Unassigned —</option>
                  {fieldStaff.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </label>
              {editLead && (
                <div className="field">
                  <span>Shared-visit co-attendees</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    {fieldStaff.filter(u => u.id !== editLead).map(u => (
                      <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={editAttendees.includes(u.id)}
                          onChange={e => setEditAttendees(prev => e.target.checked ? [...prev, u.id] : prev.filter(x => x !== u.id))}
                        />
                        <span>{u.name} ({u.role})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-primary" disabled={busy}>Save changes</button>
                  <button type="button" className="btn" onClick={() => setOpenVisit(null)}>Close</button>
                </div>
                <button type="button" className="btn" style={{ color: 'var(--bad)' }} disabled={busy} onClick={cancelVisit}>
                  Cancel visit
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

