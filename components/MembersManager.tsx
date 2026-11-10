'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from './ui';
import { initials } from '@/lib/format';

const WATCH_COLORS: Record<string, string> = {
  red: '#c92a2a',
  orange: '#d9480f',
  yellow: '#e67700',
  green: '#2b8a3e',
};

export default function MembersManager({
  members,
  fieldStaff,
  taxonomy,
  industries,
  portals,
  canCreate,
  canAssign,
}: {
  members: any[];
  fieldStaff: any[];
  taxonomy: { groupLabel: string; groups: any[] };
  industries: any[];
  portals: any[];
  canCreate: boolean;
  canAssign: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Directory Filter Bar
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [industryFilter, setIndustryFilter] = useState('ALL');
  const [watchFilter, setWatchFilter] = useState('ALL');

  const selected = members.find(m => m.id === selectedId) ?? null;

  // Edit / Manage state for selected member
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [editGroupId, setEditGroupId] = useState('');
  const [editIndLineId, setEditIndLineId] = useState('');
  const [editSubsector, setEditSubsector] = useState('');
  const [editWatch, setEditWatch] = useState('none');
  const [editFlags, setEditFlags] = useState('');
  const [editEmployees, setEditEmployees] = useState('');
  const [editBrokerFirm, setEditBrokerFirm] = useState('');
  const [editBrokerName, setEditBrokerName] = useState('');
  const [editBrokerEmail, setEditBrokerEmail] = useState('');
  const [editOps, setEditOps] = useState('');

  // Add Site state
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteAddress, setNewSiteAddress] = useState('');
  const [newSiteJur, setNewSiteJur] = useState('CA');
  const [newSiteEmployees, setNewSiteEmployees] = useState('');

  // New Member state
  const [mName, setMName] = useState('');
  const [mGroupId, setMGroupId] = useState(taxonomy.groups[0]?.id || '');
  const [mIndLineId, setMIndLineId] = useState(industries[0]?.id || '');
  const [mSubsector, setMSubsector] = useState('');
  const [mIndustry, setMIndustry] = useState('');
  const [mCity, setMCity] = useState('');
  const [mWatch, setMWatch] = useState('none');
  const [mFlags, setMFlags] = useState('');
  const [mEmployees, setMEmployees] = useState('');
  const [mOps, setMOps] = useState('');
  const [mBrokerFirm, setMBrokerFirm] = useState('');
  const [mBrokerName, setMBrokerName] = useState('');
  const [mBrokerEmail, setMBrokerEmail] = useState('');
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [sName, setSName] = useState('Main Facility');
  const [sAddress, setSAddress] = useState('');
  const [sJur, setSJur] = useState('CA');
  const [createTeamIds, setCreateTeamIds] = useState<string[]>([]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter(m => {
      if (groupFilter !== 'ALL' && (m.group_id || 'NONE') !== groupFilter) return false;
      if (industryFilter !== 'ALL' && m.industry_line_id !== industryFilter) return false;
      if (watchFilter !== 'ALL' && (m.watch_tier || 'none') !== watchFilter) return false;
      if (q) {
        const hay = [
          m.name,
          m.industry,
          m.shield_brand,
          m.group_code,
          m.city,
          m.broker_firm,
          m.broker_name,
          m.contact,
          ...(m.sites || []).map((st: any) => `${st.name} ${st.jurisdiction}`),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [members, search, groupFilter, industryFilter, watchFilter]);

  function openMember(m: any) {
    setSelectedId(m.id);
    setTeamIds(m.team.map((t: any) => t.id));
    setEditGroupId(m.group_id || '');
    setEditIndLineId(m.industry_line_id || '');
    setEditSubsector(m.subsector_code || '');
    setEditWatch(m.watch_tier || 'none');
    setEditFlags((m.flags || []).join(', '));
    setEditEmployees(m.employee_count != null ? String(m.employee_count) : '');
    setEditBrokerFirm(m.broker_firm || '');
    setEditBrokerName(m.broker_name || '');
    setEditBrokerEmail(m.broker_email || '');
    setEditOps(m.description_of_operations || '');
    setNewSiteName('');
    setNewSiteAddress('');
    setNewSiteEmployees('');
    setNewSiteJur(m.sites[0]?.jurisdiction ?? 'CA');
  }

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    const chosenLine = industries.find(l => l.id === editIndLineId);
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update_member',
        memberId: selected.id,
        groupId: editGroupId || null,
        industryLineId: editIndLineId || null,
        industry: chosenLine?.name || selected.industry,
        subsectorCode: editSubsector || null,
        watchTier: editWatch,
        flags: editFlags,
        employeeCount: editEmployees,
        brokerFirm: editBrokerFirm,
        brokerName: editBrokerName,
        brokerEmail: editBrokerEmail,
        descriptionOfOperations: editOps,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) router.refresh();
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
      body: JSON.stringify({
        action: 'add_site',
        memberId: selected.id,
        siteName: newSiteName,
        address: newSiteAddress,
        jurisdiction: newSiteJur,
        employeeCount: newSiteEmployees || undefined,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setNewSiteName('');
      setNewSiteAddress('');
      setNewSiteEmployees('');
      router.refresh();
    }
  }

  async function createMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const chosenLine = industries.find(l => l.id === mIndLineId);
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create_member',
        name: mName,
        groupId: mGroupId || null,
        industryLineId: mIndLineId || null,
        subsectorCode: mSubsector || null,
        industry: mIndustry.trim() || chosenLine?.name || 'General',
        city: mCity,
        watchTier: mWatch,
        flags: mFlags,
        employeeCount: mEmployees || undefined,
        descriptionOfOperations: mOps,
        brokerFirm: mBrokerFirm,
        brokerName: mBrokerName,
        brokerEmail: mBrokerEmail,
        contactName: cName,
        contactEmail: cEmail,
        siteName: sName,
        siteAddress: sAddress,
        jurisdiction: sJur,
        assignedUserIds: createTeamIds,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setCreating(false);
      setMName('');
      setMIndustry('');
      setMCity('');
      setMOps('');
      setCName('');
      setCEmail('');
      setCreateTeamIds([]);
      router.refresh();
    }
  }

  const editLineObj = industries.find(l => l.id === editIndLineId);
  const createLineObj = industries.find(l => l.id === mIndLineId);
  const jurisdictionOptions =
    portals.length > 0
      ? portals.map(p => ({ code: p.code, label: `${p.code} — ${p.name}` }))
      : ['CA', 'WA', 'OR', 'NV', 'FED', 'AZ', 'TX', 'UT', 'MI', 'NY', 'FL'].map(c => ({ code: c, label: c }));

  return (
    <>
      {/* Filter & Export Bar */}
      <Frame style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input
          className="input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search Member, city, broker, site, or code…"
          style={{ flex: '1 1 220px' }}
        />
        <select className="select" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
          <option value="ALL">All {taxonomy.groupLabel}</option>
          {taxonomy.groups.map(g => (
            <option key={g.id} value={g.id}>
              {g.code} — {g.name}
            </option>
          ))}
          <option value="NONE">Unassigned Group</option>
        </select>

        <select className="select" value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}>
          <option value="ALL">All Shield / Industry Lines</option>
          {industries.map(l => (
            <option key={l.id} value={l.id}>
              {l.shield_brand ? `${l.shield_brand} (${l.code})` : l.name}
            </option>
          ))}
        </select>

        <select className="select" value={watchFilter} onChange={e => setWatchFilter(e.target.value)}>
          <option value="ALL">All Watch Tiers</option>
          <option value="red">Red Watch-List</option>
          <option value="orange">Orange Watch-List</option>
          <option value="yellow">Yellow Watch-List</option>
          <option value="green">Green / Preferred</option>
          <option value="none">No Watch Tier</option>
        </select>

        <a href="/api/members?export=csv" className="btn btn-sm" download>
          ↓ Export CSV
        </a>
        {canCreate && (
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            + New Member
          </button>
        )}
      </Frame>

      <div className="cards">
        {filteredMembers.map(m => (
          <Frame
            key={m.id}
            className={m.team.length ? '' : 'warn'}
            style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {m.group_code && (
                <span
                  className="pill"
                  style={{ background: m.group_color || 'var(--acc)', color: '#fff', fontWeight: 700 }}
                >
                  {m.group_code}
                </span>
              )}
              {m.shield_brand && <Pill kind="ink">{m.shield_brand}</Pill>}
              {m.watch_tier && m.watch_tier !== 'none' && (
                <span
                  className="pill"
                  style={{
                    background: WATCH_COLORS[m.watch_tier] || 'var(--warn7)',
                    color: '#fff',
                    textTransform: 'uppercase',
                  }}
                >
                  {m.watch_tier} Watch
                </span>
              )}
              {!m.team.length && <Pill kind="unassigned">Unassigned</Pill>}
            </div>

            <div>
              <div className="kicker">
                {m.industry} {m.subsector_code ? `· ${m.subsector_code}` : ''} {m.city ? `· ${m.city}` : ''}
                {m.employee_count ? ` · ${m.employee_count} emp` : ''}
              </div>
              <div
                style={{
                  font: '700 19px/1.15 var(--fh)',
                  letterSpacing: '.02em',
                  textTransform: 'uppercase',
                  marginTop: 3,
                }}
              >
                {m.name}
              </div>
            </div>

            {m.flags?.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {m.flags.map((fl: string) => (
                  <Pill key={fl} kind="amber">
                    ⚑ {fl}
                  </Pill>
                ))}
              </div>
            )}

            {m.relationships?.length > 0 && (
              <div className="sub" style={{ fontSize: 11.5 }}>
                {m.relationships.map((r: any) => (
                  <div key={r.id}>
                    ⇄ {r.from_member_id === m.id ? `${r.relationship_code} → ${r.to_name}` : `${r.from_name} → ${r.relationship_code}`}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {m.sites.map((st: any) => (
                <div key={st.id} style={{ display: 'flex', gap: 8, fontSize: 12.5, alignItems: 'center' }}>
                  <Pill kind="line">{st.jurisdiction}</Pill>
                  <span>{st.name}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                paddingTop: 11,
                borderTop: '1px solid var(--div2)',
                marginTop: 'auto',
              }}
            >
              {m.team.map((t: any) => (
                <span key={t.id} className="avatar sm" title={t.name}>
                  {initials(t.name)}
                </span>
              ))}
              <span style={{ fontSize: 12, color: 'var(--n6)', flex: 1 }}>
                {m.broker_firm ? `Broker: ${m.broker_firm}` : m.contact}
              </span>
              {(canAssign || canCreate) && (
                <button className="btn btn-sm" onClick={() => openMember(m)}>
                  Manage
                </button>
              )}
              <Link href={'/recommendations?tab=All&member=' + m.id} style={{ fontSize: 12, fontWeight: 600 }}>
                {m.open} open →
              </Link>
            </div>
          </Frame>
        ))}
      </div>

      {selected && (
        <>
          <div className="drawer-bg" onClick={() => setSelectedId(null)} />
          <aside className="drawer" role="dialog" aria-label={selected.name} style={{ maxWidth: 640, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">
                  {selected.id} · {selected.industry} · {selected.city}
                </div>
                <h2>{selected.name}</h2>
              </div>
              <button
                className="btn"
                style={{ width: 36, height: 36, padding: 0 }}
                onClick={() => setSelectedId(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="drawer-body">
              <dl className="frame facts" style={{ margin: 0 }}>
                <div>
                  <dt>Primary contact</dt>
                  <dd>{selected.contact || '—'}</dd>
                </div>
                <div>
                  <dt>Contact email</dt>
                  <dd>{selected.contact_email || '—'}</dd>
                </div>
              </dl>

              {canCreate && (
                <form
                  onSubmit={saveProfile}
                  className="frame"
                  style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  <div className="kicker">
                    {taxonomy.groupLabel}, Shield Industry, Broker &amp; ARU Operations Profile
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label className="field">
                      <span>{taxonomy.groupLabel}</span>
                      <select className="select" value={editGroupId} onChange={e => setEditGroupId(e.target.value)}>
                        <option value="">— Unassigned —</option>
                        {taxonomy.groups.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.code} — {g.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Watch-List Tier</span>
                      <select className="select" value={editWatch} onChange={e => setEditWatch(e.target.value)}>
                        <option value="none">None / Standard</option>
                        <option value="green">Green (Preferred Risk)</option>
                        <option value="yellow">Yellow (Monitor)</option>
                        <option value="orange">Orange (Elevated Action Plan)</option>
                        <option value="red">Red (Board Watch-List)</option>
                      </select>
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label className="field">
                      <span>Shield / Industry Line</span>
                      <select
                        className="select"
                        value={editIndLineId}
                        onChange={e => {
                          setEditIndLineId(e.target.value);
                          setEditSubsector('');
                        }}
                      >
                        <option value="">— Select Industry Line —</option>
                        {industries.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.shield_brand ? `${l.shield_brand} — ${l.name}` : l.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Sub-Sector</span>
                      <select
                        className="select"
                        value={editSubsector}
                        onChange={e => setEditSubsector(e.target.value)}
                      >
                        <option value="">— Any / General —</option>
                        {(editLineObj?.subsectors || []).map((sub: any) => (
                          <option key={sub.code} value={sub.code}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
                    <label className="field">
                      <span>Employees</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={editEmployees}
                        onChange={e => setEditEmployees(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Custom Flags (comma-separated)</span>
                      <input
                        className="input"
                        value={editFlags}
                        onChange={e => setEditFlags(e.target.value)}
                        placeholder="High Ex-Mod, New Member, Bilingual Spanish"
                      />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <label className="field">
                      <span>Brokerage Firm</span>
                      <input className="input" value={editBrokerFirm} onChange={e => setEditBrokerFirm(e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Broker Contact</span>
                      <input className="input" value={editBrokerName} onChange={e => setEditBrokerName(e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Broker Email (cc:)</span>
                      <input
                        className="input"
                        type="email"
                        value={editBrokerEmail}
                        onChange={e => setEditBrokerEmail(e.target.value)}
                      />
                    </label>
                  </div>

                  <label className="field">
                    <span>Description of Operations (auto-populates ARU Visit &amp; Cover Letters)</span>
                    <textarea
                      className="input"
                      rows={3}
                      value={editOps}
                      onChange={e => setEditOps(e.target.value)}
                      placeholder="Describe primary operations, shifts, equipment, fleet & seasonal workforce..."
                    />
                  </label>

                  <div>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                      Save Member Profile
                    </button>
                  </div>
                </form>
              )}

              {canAssign && (
                <div className="frame" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="kicker">Assigned Consultants &amp; Supervisors</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {fieldStaff.map(u => {
                      const checked = teamIds.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e =>
                              setTeamIds(prev => (e.target.checked ? [...prev, u.id] : prev.filter(x => x !== u.id)))
                            }
                          />
                          <span style={{ fontWeight: 500 }}>{u.name}</span>
                          <span className="kicker">({u.role})</span>
                        </label>
                      );
                    })}
                  </div>
                  <div>
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={saveAssignments}>
                      Save Assignments
                    </button>
                  </div>
                </div>
              )}

              <div className="frame" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="kicker">Sites &amp; 56-Jurisdiction Routing ({selected.sites.length})</div>
                {selected.sites.map((st: any) => (
                  <div key={st.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}>
                    <Pill kind="line">{st.jurisdiction}</Pill>
                    <span style={{ fontWeight: 600 }}>{st.name}</span>
                    {st.employee_count ? <span className="sub">({st.employee_count} emp)</span> : null}
                    {st.address ? <span className="sub">· {st.address}</span> : null}
                  </div>
                ))}
                {canCreate && (
                  <form
                    onSubmit={addSite}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 130px 90px auto',
                      gap: 8,
                      marginTop: 6,
                      paddingTop: 10,
                      borderTop: '1px solid var(--div2)',
                    }}
                  >
                    <input
                      className="input"
                      value={newSiteName}
                      onChange={e => setNewSiteName(e.target.value)}
                      placeholder="Site name"
                      required
                    />
                    <input
                      className="input"
                      value={newSiteAddress}
                      onChange={e => setNewSiteAddress(e.target.value)}
                      placeholder="Address / City"
                    />
                    <select className="select" value={newSiteJur} onChange={e => setNewSiteJur(e.target.value)}>
                      {jurisdictionOptions.map(j => (
                        <option key={j.code} value={j.code}>
                          {j.code}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={newSiteEmployees}
                      onChange={e => setNewSiteEmployees(e.target.value)}
                      placeholder="Emp #"
                    />
                    <button type="submit" className="btn btn-sm" disabled={busy}>
                      + Add
                    </button>
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
          <aside className="drawer" role="dialog" aria-label="New Member" style={{ maxWidth: 640, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Member onboarding</div>
                <h2>New Member &amp; Primary Site</h2>
              </div>
              <button
                className="btn"
                style={{ width: 36, height: 36, padding: 0 }}
                onClick={() => setCreating(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={createMember} className="drawer-body">
              <div className="frame" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="kicker">Organization, {taxonomy.groupLabel} &amp; Shield Taxonomy</div>
                <label className="field">
                  <span>Member name</span>
                  <input
                    className="input"
                    value={mName}
                    onChange={e => setMName(e.target.value)}
                    required
                    placeholder="Salinas Valley Cold Storage, LLC"
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="field">
                    <span>{taxonomy.groupLabel}</span>
                    <select className="select" value={mGroupId} onChange={e => setMGroupId(e.target.value)}>
                      <option value="">— Unassigned —</option>
                      {taxonomy.groups.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.code} — {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Watch-List Tier</span>
                    <select className="select" value={mWatch} onChange={e => setMWatch(e.target.value)}>
                      <option value="none">None / Standard</option>
                      <option value="green">Green (Preferred)</option>
                      <option value="yellow">Yellow (Monitor)</option>
                      <option value="orange">Orange (Action Plan)</option>
                      <option value="red">Red (Board Watch-List)</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="field">
                    <span>Shield / Industry Line</span>
                    <select
                      className="select"
                      value={mIndLineId}
                      onChange={e => {
                        setMIndLineId(e.target.value);
                        setMSubsector('');
                      }}
                    >
                      {industries.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.shield_brand ? `${l.shield_brand} — ${l.name}` : l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Sub-Sector</span>
                    <select className="select" value={mSubsector} onChange={e => setMSubsector(e.target.value)}>
                      <option value="">— General —</option>
                      {(createLineObj?.subsectors || []).map((sub: any) => (
                        <option key={sub.code} value={sub.code}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: 10 }}>
                  <label className="field">
                    <span>Specific Trade / NAICS Label</span>
                    <input
                      className="input"
                      value={mIndustry}
                      onChange={e => setMIndustry(e.target.value)}
                      placeholder={createLineObj?.name || 'Packing & Cold Storage'}
                    />
                  </label>
                  <label className="field">
                    <span>City / State</span>
                    <input
                      className="input"
                      value={mCity}
                      onChange={e => setMCity(e.target.value)}
                      required
                      placeholder="Salinas, CA"
                    />
                  </label>
                  <label className="field">
                    <span>Employees</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={mEmployees}
                      onChange={e => setMEmployees(e.target.value)}
                      placeholder="85"
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Flags (comma-separated)</span>
                  <input
                    className="input"
                    value={mFlags}
                    onChange={e => setMFlags(e.target.value)}
                    placeholder="New Member, Ammonia PSM, Spanish Crew"
                  />
                </label>

                <label className="field">
                  <span>Description of Operations</span>
                  <textarea
                    className="input"
                    rows={2}
                    value={mOps}
                    onChange={e => setMOps(e.target.value)}
                    placeholder="Year-round leafy greens hydro-cooling, cold storage racking, 14 electric forklifts..."
                  />
                </label>
              </div>

              <div className="frame" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="kicker">Primary Site (56-Jurisdiction Routing)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 170px', gap: 10 }}>
                  <label className="field">
                    <span>Site name</span>
                    <input className="input" value={sName} onChange={e => setSName(e.target.value)} required />
                  </label>
                  <label className="field">
                    <span>Jurisdiction</span>
                    <select className="select" value={sJur} onChange={e => setSJur(e.target.value)}>
                      {jurisdictionOptions.map(j => (
                        <option key={j.code} value={j.code}>
                          {j.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Site street address</span>
                  <input
                    className="input"
                    value={sAddress}
                    onChange={e => setSAddress(e.target.value)}
                    placeholder="1240 Abbott St, Salinas, CA 93901"
                  />
                </label>
              </div>

              <div className="frame" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="kicker">Primary Member Contact &amp; Broker</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="field">
                    <span>Member Contact Name</span>
                    <input
                      className="input"
                      value={cName}
                      onChange={e => setCName(e.target.value)}
                      required
                      placeholder="Dana Alverez"
                    />
                  </label>
                  <label className="field">
                    <span>Member Contact Email</span>
                    <input
                      className="input"
                      type="email"
                      value={cEmail}
                      onChange={e => setCEmail(e.target.value)}
                      required
                      placeholder="dana@example.com"
                    />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <label className="field">
                    <span>Brokerage Firm</span>
                    <input className="input" value={mBrokerFirm} onChange={e => setMBrokerFirm(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Broker Name</span>
                    <input className="input" value={mBrokerName} onChange={e => setMBrokerName(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Broker Email</span>
                    <input
                      className="input"
                      type="email"
                      value={mBrokerEmail}
                      onChange={e => setMBrokerEmail(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="frame" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="kicker">Assign Consultants</div>
                {fieldStaff.map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={createTeamIds.includes(u.id)}
                      onChange={e =>
                        setCreateTeamIds(prev => (e.target.checked ? [...prev, u.id] : prev.filter(x => x !== u.id)))
                      }
                    />
                    <span>{u.name}</span>
                    <span className="kicker">({u.role})</span>
                  </label>
                ))}
              </div>

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Create Member
                </button>
                <button type="button" className="btn" onClick={() => setCreating(false)}>
                  Cancel
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
