'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pill } from './ui';
import { initials, shortName, fmtDate } from '@/lib/format';
import { TEAM_PERMISSION_LABELS, TEAM_ROLE_DEFAULTS, type TeamRole, type TeamPermission } from '@/lib/acl-catalog';

const COMPLIMENTARY_ROLES = new Set(['admin', 'viewer']);

export default function TeamManager({
  team,
  seatRequests,
  taxonomy,
  viewerRole,
  canManageTeam,
  canManageAcl,
  canInviteAdmin,
  canSpendMoney,
}: {
  team: any[];
  seatRequests: any[];
  taxonomy: { groupLabel: string; groups: any[] };
  viewerRole: string;
  canManageTeam: boolean;
  canManageAcl: boolean;
  canInviteAdmin: boolean;
  canSpendMoney: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [drawerTab, setDrawerTab] = useState<'profile' | 'acl' | 'groups'>('profile');
  const [editRole, setEditRole] = useState('');
  const [editSup, setEditSup] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [aclOverrides, setAclOverrides] = useState<Record<string, 'inherit' | 'allow' | 'deny'>>({});
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const supervisors = team.filter(u => u.role === 'supervisor' && u.status === 'active');
  const groupMap = Object.fromEntries((taxonomy.groups || []).map((g: any) => [g.id, g]));

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function openUser(u: any, tab: 'profile' | 'acl' | 'groups' = 'profile') {
    setSelectedUser(u);
    setDrawerTab(tab);
    setEditRole(u.role);
    setEditSup(u.supervisor_id ?? '');
    setEditStatus(u.status);

    const ovMap: Record<string, 'inherit' | 'allow' | 'deny'> = {};
    for (const p of TEAM_PERMISSION_LABELS) {
      const found = (u.acl_overrides || []).find((o: any) => o.permission_key === p.key);
      ovMap[p.key] = found ? found.effect : 'inherit';
    }
    setAclOverrides(ovMap);
    setSelectedGroups(Array.isArray(u.group_scopes) ? [...u.group_scopes] : []);
  }

  async function approveRequest(requestId: string) {
    setBusy(true);
    const res = await fetch('/api/team/seat-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', requestId }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) router.refresh();
  }

  async function submitDecline(e: React.FormEvent, requestId: string) {
    e.preventDefault();
    if (!declineReason.trim()) return;
    setBusy(true);
    const res = await fetch('/api/team/seat-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'decline', requestId, reason: declineReason }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setDecliningId(null);
      setDeclineReason('');
      router.refresh();
    }
  }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setBusy(true);
    const res = await fetch('/api/team/seat-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update_user',
        userId: selectedUser.id,
        role: editRole,
        supervisorId: editRole === 'consultant' ? editSup || null : null,
        status: editStatus,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setSelectedUser(null);
      router.refresh();
    }
  }

  async function saveAcl(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setBusy(true);
    const res = await fetch('/api/team/seat-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'set_user_acl',
        userId: selectedUser.id,
        overrides: aclOverrides,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setSelectedUser(null);
      router.refresh();
    }
  }

  async function saveGroupScopes(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setBusy(true);
    const res = await fetch('/api/team/seat-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'set_user_groups',
        userId: selectedUser.id,
        groupIds: selectedGroups,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setSelectedUser(null);
      router.refresh();
    }
  }

  const scopeSummary = (u: any) => {
    const base =
      u.role === 'owner'
        ? 'Full workspace & billing'
        : u.role === 'admin'
        ? 'Team Admin console'
        : u.role === 'supervisor'
        ? 'Crew: ' + (u.crew ?? 'none')
        : u.role === 'underwriting'
        ? 'Captive / Underwriting analytics & share links'
        : u.role === 'viewer'
        ? 'Read-only workspace viewer'
        : 'Assigned Members' + (u.supervisor_name ? ' · reports to ' + shortName(u.supervisor_name) : '');
    return base;
  };

  const roleDefaultsForSelected = new Set<TeamPermission>(
    TEAM_ROLE_DEFAULTS[(selectedUser?.role || 'consultant') as TeamRole] || []
  );

  return (
    <>
      {seatRequests.length > 0 && (
        <div className="frame strong" style={{ marginBottom: 4 }}>
          <div className="panel-head">
            <h2>Seat requests</h2>
            <span className="kicker">Team Admin invites when licensed seats are full require Owner approval</span>
          </div>
          {seatRequests.map(sr => (
            <div
              key={sr.id}
              className="row"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 14,
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'default',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{sr.invite_email}</span>
                  <Pill kind="ink">{sr.invite_role}</Pill>
                  <Pill kind={sr.status === 'pending' ? 'unassigned' : sr.status === 'approved' ? 'verified' : 'overdue'}>
                    {sr.status}
                  </Pill>
                </div>
                <div className="kicker">
                  Requested by {sr.requested_by_name} on {fmtDate(sr.created_at)}
                  {sr.decided_by_name ? ` · ${sr.status} by ${sr.decided_by_name}` : ''}
                </div>
                {sr.reason && <div style={{ fontSize: 12.5, color: 'var(--n7)' }}>Note: {sr.reason}</div>}
                {sr.decline_reason && (
                  <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 2 }}>
                    Reason: &ldquo;{sr.decline_reason}&rdquo;
                  </div>
                )}
              </div>

              {sr.status === 'pending' && canSpendMoney && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  {decliningId === String(sr.id) ? (
                    <form onSubmit={e => submitDecline(e, String(sr.id))} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        className="input"
                        value={declineReason}
                        onChange={e => setDeclineReason(e.target.value)}
                        placeholder="1-line reason for Admin…"
                        required
                        style={{ width: 220 }}
                      />
                      <button type="submit" className="btn btn-sm" style={{ color: 'var(--bad)' }} disabled={busy}>
                        Confirm decline
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => setDecliningId(null)}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => approveRequest(String(sr.id))}>
                        Approve &amp; buy seat
                      </button>
                      <button
                        className="btn btn-sm"
                        disabled={busy}
                        onClick={() => {
                          setDecliningId(String(sr.id));
                          setDeclineReason('');
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <table className="tbl" style={{ minWidth: 860 }}>
        <thead>
          <tr>
            <th>Person</th>
            <th>Role</th>
            <th>Scope &amp; {taxonomy.groupLabel}</th>
            <th>ACL Overrides</th>
            <th>Seat</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {team.map(u => {
            const ovCount = (u.acl_overrides || []).length;
            const gScopes: string[] = u.group_scopes || [];
            const isPlatComp = Boolean(u.is_complimentary_seat);
            const isFree = COMPLIMENTARY_ROLES.has(u.role) || isPlatComp;
            return (
              <tr key={u.id} className="click" onClick={() => openUser(u, 'profile')}>
                <td>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className="avatar">{initials(u.name)}</span>
                    <span>
                      <span style={{ fontWeight: 500 }}>{u.name}</span>
                      <span className="sub">{u.email}</span>
                    </span>
                  </span>
                </td>
                <td className="kicker" style={{ color: 'var(--ink)' }}>
                  {u.role}
                </td>
                <td style={{ fontSize: 12.5, color: 'var(--n7)' }}>
                  <div>{scopeSummary(u)}</div>
                  {gScopes.length > 0 ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {gScopes.map(gid => {
                        const g = groupMap[gid];
                        return g ? (
                          <span
                            key={gid}
                            className="pill"
                            style={{
                              background: g.accent_color || 'var(--acc)',
                              color: '#fff',
                              fontSize: 10,
                              padding: '1px 6px',
                            }}
                          >
                            {g.code}
                          </span>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <div className="sub" style={{ fontSize: 11 }}>
                      All {taxonomy.groupLabel}
                    </div>
                  )}
                </td>
                <td>
                  {ovCount > 0 ? (
                    <Pill kind="amber">{ovCount} custom override{ovCount === 1 ? '' : 's'}</Pill>
                  ) : (
                    <span className="kicker">Role default</span>
                  )}
                </td>
                <td>
                  <Pill kind={isPlatComp ? 'verified' : isFree ? 'line' : 'ink'}>
                    {isPlatComp ? 'Platform ($0)' : isFree ? 'Free ($0)' : 'Paid seat'}
                  </Pill>
                </td>
                <td className="kicker" style={{ color: u.status === 'active' ? 'var(--ok)' : 'var(--warn7)' }}>
                  {u.status}
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn btn-sm" onClick={() => openUser(u, 'acl')}>
                      ACL Matrix
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => openUser(u, 'groups')}>
                      {taxonomy.groupLabel}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selectedUser && (
        <>
          <div className="drawer-bg" onClick={() => setSelectedUser(null)} />
          <aside className="drawer" role="dialog" aria-label={selectedUser.name} style={{ maxWidth: 640, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">
                  {selectedUser.id} · {selectedUser.email}
                </div>
                <h2>{selectedUser.name}</h2>
              </div>
              <button
                className="btn"
                style={{ width: 36, height: 36, padding: 0 }}
                onClick={() => setSelectedUser(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{ padding: '10px 20px 0', borderBottom: '1px solid var(--div)' }}>
              <div className="tabs">
                <button
                  type="button"
                  className={'tab ' + (drawerTab === 'profile' ? 'on' : '')}
                  onClick={() => setDrawerTab('profile')}
                >
                  1. Role &amp; Status
                </button>
                <button
                  type="button"
                  className={'tab ' + (drawerTab === 'acl' ? 'on' : '')}
                  onClick={() => setDrawerTab('acl')}
                >
                  2. 14-Permission ACL Matrix
                </button>
                <button
                  type="button"
                  className={'tab ' + (drawerTab === 'groups' ? 'on' : '')}
                  onClick={() => setDrawerTab('groups')}
                >
                  3. {taxonomy.groupLabel} Scopes
                </button>
              </div>
            </div>

            {drawerTab === 'profile' && (
              <form onSubmit={saveUser} className="drawer-body">
                <label className="field">
                  <span>
                    Workspace Role{' '}
                    {selectedUser.role === 'owner' && viewerRole !== 'owner' ? '(Owner required to edit Owners)' : ''}
                  </span>
                  <select
                    className="select"
                    value={editRole}
                    onChange={e => setEditRole(e.target.value)}
                    disabled={!canManageTeam || (selectedUser.role === 'owner' && viewerRole !== 'owner')}
                  >
                    <option value="consultant">Consultant (licensed seat · field execution)</option>
                    <option value="supervisor">Supervisor (licensed seat · crew &amp; QC review)</option>
                    <option value="underwriting">Underwriting / Captive Analyst (licensed seat)</option>
                    <option value="viewer">Read-Only Viewer ($0 complimentary)</option>
                    {(canInviteAdmin || editRole === 'admin') && (
                      <option value="admin">Team Admin ($0 complimentary · workspace management)</option>
                    )}
                    {(viewerRole === 'owner' || editRole === 'owner') && (
                      <option value="owner">Workspace Owner (licensed seat · billing &amp; co-owner · max 2)</option>
                    )}
                  </select>
                </label>

                {editRole === 'consultant' && (
                  <label className="field">
                    <span>Reports to Supervisor (Crew assignment)</span>
                    <select className="select" value={editSup} onChange={e => setEditSup(e.target.value)} disabled={!canManageTeam}>
                      <option value="">— No Supervisor (direct to Admin/Owner) —</option>
                      {supervisors
                        .filter(s => s.id !== selectedUser.id)
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}

                <label className="field">
                  <span>Account Status (Suspending immediately revokes active sessions)</span>
                  <select
                    className="select"
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    disabled={!canManageTeam}
                  >
                    <option value="active">Active</option>
                    <option value="invited">Invited</option>
                    <option value="suspended">Suspended (frees licensed seat &amp; revokes sessions)</option>
                  </select>
                </label>

                <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                  <button type="submit" className="btn btn-primary" disabled={busy || !canManageTeam}>
                    Save Role &amp; Status
                  </button>
                  <button type="button" className="btn" onClick={() => setSelectedUser(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {drawerTab === 'acl' && (
              <form onSubmit={saveAcl} className="drawer-body">
                <div className="note" style={{ marginBottom: 8 }}>
                  Configure per-user capability overrides. <strong>Explicit Deny</strong> always wins over role defaults
                  (except Owners cannot deny their own <code>team:acl.manage</code>).
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {TEAM_PERMISSION_LABELS.map(p => {
                    const currentEffect = aclOverrides[p.key] || 'inherit';
                    const roleHasDefault = roleDefaultsForSelected.has(p.key);
                    const effective =
                      currentEffect === 'allow' ? true : currentEffect === 'deny' ? false : roleHasDefault;
                    const lockedOwnerAcl = selectedUser.role === 'owner' && p.key === 'team:acl.manage';

                    return (
                      <div
                        key={p.key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          background: 'var(--bg-soft)',
                          border: '1px solid var(--div2)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.label}</span>
                            <Pill kind={effective ? 'ok' : 'line'}>{effective ? 'Granted' : 'Blocked'}</Pill>
                          </div>
                          <div className="mono" style={{ fontSize: 10.5, color: 'var(--n6)' }}>
                            {p.key} · Role default: {roleHasDefault ? 'Allow' : 'None'}
                          </div>
                        </div>
                        <select
                          className="select"
                          style={{ width: 135 }}
                          disabled={!canManageAcl || lockedOwnerAcl}
                          value={currentEffect}
                          onChange={e =>
                            setAclOverrides(prev => ({
                              ...prev,
                              [p.key]: e.target.value as 'inherit' | 'allow' | 'deny',
                            }))
                          }
                        >
                          <option value="inherit">Inherit ({roleHasDefault ? 'Allow' : 'Off'})</option>
                          <option value="allow">Explicit Allow</option>
                          <option value="deny">Explicit Deny</option>
                        </select>
                      </div>
                    );
                  })}
                </div>

                <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                  <button type="submit" className="btn btn-primary" disabled={busy || !canManageAcl}>
                    Save ACL Matrix Overrides
                  </button>
                  <button type="button" className="btn" onClick={() => setSelectedUser(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {drawerTab === 'groups' && (
              <form onSubmit={saveGroupScopes} className="drawer-body">
                <div className="note" style={{ marginBottom: 8 }}>
                  Restrict {selectedUser.name} to specific <strong>{taxonomy.groupLabel}</strong> (e.g. specific SIG
                  &ldquo;Gems&rdquo; like <code>CAN</code>, <code>CAP</code>, or <code>RSA</code>). Leave all unchecked
                  to grant access across every group in your workspace.
                </div>

                {(taxonomy.groups || []).length === 0 ? (
                  <div className="banner">
                    No {taxonomy.groupLabel} configured yet. Add groups under Settings → Groups, Industries &amp;
                    Hierarchy.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(taxonomy.groups || []).map((g: any) => {
                      const checked = selectedGroups.includes(g.id);
                      return (
                        <label
                          key={g.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 12px',
                            background: 'var(--bg-soft)',
                            border: '1px solid var(--div2)',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canManageTeam && !canManageAcl}
                            onChange={e =>
                              setSelectedGroups(prev =>
                                e.target.checked ? [...prev, g.id] : prev.filter(id => id !== g.id)
                              )
                            }
                          />
                          <span
                            className="pill"
                            style={{ background: g.accent_color || 'var(--acc)', color: '#fff', fontWeight: 700 }}
                          >
                            {g.code}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</div>
                            <div className="kicker">
                              {g.group_type} · {g.billing_mode}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setSelectedGroups([])}
                    disabled={selectedGroups.length === 0}
                  >
                    Clear Filter (Grant All {taxonomy.groupLabel})
                  </button>
                </div>

                <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={busy || (!canManageTeam && !canManageAcl)}
                  >
                    Save {taxonomy.groupLabel} Scopes
                  </button>
                  <button type="button" className="btn" onClick={() => setSelectedUser(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </aside>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
