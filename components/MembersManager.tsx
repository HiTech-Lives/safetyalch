'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from './ui';
import { initials } from '@/lib/format';

const JURISDICTIONS = ['CA', 'WA', 'OR', 'NV', 'FED', 'AZ', 'TX', 'UT'];

export default function MembersManager({
  members,
  fieldStaff,
  canCreate,
  canAssign,
}: {
  members: any[];
  fieldStaff: any[];
  canCreate: boolean;
  canAssign: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Assignment state for selected member
  const selected = members.find(m => m.id === selectedId) ?? null;
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteJur, setNewSiteJur] = useState('CA');

  // New Member state
  const [mName, setMName] = useState('');
  const [mIndustry, setMIndustry] = useState('');
  const [mCity, setMCity] = useState('');
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cRole, setCRole] = useState('Safety Director');
  const [sName, setSName] = useState('Main Facility');
  const [sJur, setSJur] = useState('CA');
  const [createTeamIds, setCreateTeamIds] = useState<string[]>([]);

  function openMember(m: any) {
    setSelectedId(m.id);
    setTeamIds(m.team.map((t: any) => t.id));
    setNewSiteName('');
    setNewSiteJur(m.sites[0]?.jurisdiction ?? 'CA');
  }

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  async function saveAssignments() {
    if (!selected) return;
    setBusy(true);
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'set_assignments', memberId: selected.id, userIds: teamIds }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) router.refresh();
  }

  async function addSite(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !newSiteName.trim()) return;
    setBusy(true);
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'add_site', memberId: selected.id, siteName: newSiteName, jurisdiction: newSiteJur }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setNewSiteName('');
      router.refresh();
    }
  }

  async function createMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create_member',
        name: mName,
        industry: mIndustry,
        city: mCity,
        contactName: cName,
        contactEmail: cEmail,
        contactRole: cRole,
        siteName: sName,
        jurisdiction: sJur,
        assignedUserIds: createTeamIds,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setCreating(false);
      setMName(''); setMIndustry(''); setMCity(''); setCName(''); setCEmail('');
      setCreateTeamIds([]);
      router.refresh();
    }
  }

  return (
    <>
      {canCreate && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New Member</button>
        </div>
      )}

      <div className="cards">
        {members.map(m => (
          <Frame key={m.id} className={m.team.length ? '' : 'warn'} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="kicker">{m.industry} · {m.city}</div>
                <div style={{ font: '700 19px/1.15 var(--fh)', letterSpacing: '.02em', textTransform: 'uppercase', marginTop: 3 }}>{m.name}</div>
              </div>
              {!m.team.length && <Pill kind="unassigned">Unassigned</Pill>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {m.sites.map((st: any) => (
                <div key={st.id} style={{ display: 'flex', gap: 8, fontSize: 12.5, alignItems: 'center' }}>
                  <Pill kind="line">{st.jurisdiction}</Pill>
                  {st.name}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 11, borderTop: '1px solid var(--div2)', marginTop: 'auto' }}>
              {m.team.map((t: any) => <span key={t.id} className="avatar sm" title={t.name}>{initials(t.name)}</span>)}
              <span style={{ fontSize: 12, color: 'var(--n6)', flex: 1 }}>{m.contact}</span>
              {canAssign && (
                <button className="btn btn-sm" onClick={() => openMember(m)}>
                  {m.team.length ? 'Manage' : 'Assign'}
                </button>
              )}
              <Link href={'/recommendations?tab=All&member=' + m.id} style={{ fontSize: 12, fontWeight: 600 }}>{m.open} open →</Link>
            </div>
          </Frame>
        ))}
      </div>

      {selected && (
        <>
          <div className="drawer-bg" onClick={() => setSelectedId(null)} />
          <aside className="drawer" role="dialog" aria-label={selected.name}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">{selected.id} · {selected.industry} · {selected.city}</div>
                <h2>{selected.name}</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setSelectedId(null)} aria-label="Close">×</button>
            </div>
            <div className="drawer-body">
              <dl className="frame facts" style={{ margin: 0 }}>
                <div><dt>Primary contact</dt><dd>{selected.contact || '—'}{selected.contact_role ? ' · ' + selected.contact_role : ''}</dd></div>
                <div><dt>Contact email</dt><dd>{selected.contact_email || '—'}</dd></div>
              </dl>

              {canAssign && (
                <div className="frame" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="kicker">Assigned Consultants &amp; Supervisors</div>
                  <div style={{ fontSize: 12, color: 'var(--n6)' }}>
                    Consultants only see Members assigned to them in the mobile app and console.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {fieldStaff.map(u => {
                      const checked = teamIds.includes(u.id);
                      return (
                        <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => setTeamIds(prev => e.target.checked ? [...prev, u.id] : prev.filter(x => x !== u.id))}
                          />
                          <span style={{ fontWeight: 500 }}>{u.name}</span>
                          <span className="kicker">({u.role})</span>
                        </label>
                      );
                    })}
                  </div>
                  <div>
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={saveAssignments}>
                      Save assignments
                    </button>
                  </div>
                </div>
              )}

              <div className="frame" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="kicker">Sites &amp; Jurisdictions ({selected.sites.length})</div>
                {selected.sites.map((st: any) => (
                  <div key={st.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    <Pill kind="line">{st.jurisdiction}</Pill>
                    <span style={{ fontWeight: 500 }}>{st.name}</span>
                  </div>
                ))}
                {canCreate && (
                  <form onSubmit={addSite} style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 8, marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--div2)' }}>
                    <input className="input" value={newSiteName} onChange={e => setNewSiteName(e.target.value)} placeholder="New site name" required />
                    <select className="select" value={newSiteJur} onChange={e => setNewSiteJur(e.target.value)}>
                      {JURISDICTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                    <button type="submit" className="btn btn-sm" disabled={busy}>+ Add site</button>
                  </form>
                )}
              </div>
            </div>
          </aside>
        </>
      )}

      {creating && (
        <>
          <div className="drawer-bg" onClick={() => setCreating(false)} />
          <aside className="drawer" role="dialog" aria-label="New Member">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Member onboarding</div>
                <h2>New Member &amp; Primary Site</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setCreating(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={createMember} className="drawer-body">
              <div className="frame" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="kicker">Organization</div>
                <label className="field"><span>Member name</span><input className="input" value={mName} onChange={e => setMName(e.target.value)} required placeholder="Cascade Timberworks" /></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="field"><span>Industry</span><input className="input" value={mIndustry} onChange={e => setMIndustry(e.target.value)} required placeholder="Sawmill & Wood Products" /></label>
                  <label className="field"><span>City / State</span><input className="input" value={mCity} onChange={e => setMCity(e.target.value)} required placeholder="Eugene, OR" /></label>
                </div>
              </div>

              <div className="frame" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="kicker">Primary Site (Jurisdiction)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
                  <label className="field"><span>Site name</span><input className="input" value={sName} onChange={e => setSName(e.target.value)} required /></label>
                  <label className="field">
                    <span>Jurisdiction</span>
                    <select className="select" value={sJur} onChange={e => setSJur(e.target.value)}>
                      {JURISDICTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              <div className="frame" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="kicker">Primary Member Contact (receives reports &amp; magic links)</div>
                <label className="field"><span>Contact name</span><input className="input" value={cName} onChange={e => setCName(e.target.value)} required placeholder="Dana Alverez" /></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="field"><span>Contact email</span><input className="input" type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} required placeholder="dana@example.com" /></label>
                  <label className="field"><span>Title / Role</span><input className="input" value={cRole} onChange={e => setCRole(e.target.value)} /></label>
                </div>
              </div>

              <div className="frame" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="kicker">Assign Consultants</div>
                {fieldStaff.map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={createTeamIds.includes(u.id)}
                      onChange={e => setCreateTeamIds(prev => e.target.checked ? [...prev, u.id] : prev.filter(x => x !== u.id))}
                    />
                    <span>{u.name}</span>
                    <span className="kicker">({u.role})</span>
                  </label>
                ))}
              </div>

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>Create Member</button>
                <button type="button" className="btn" onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

