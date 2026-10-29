'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pill } from './ui';
import { initials, shortName, fmtDate } from '@/lib/format';

export default function TeamManager({
  team,
  seatRequests,
  viewerRole,
}: {
  team: any[];
  seatRequests: any[];
  viewerRole: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editSup, setEditSup] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const supervisors = team.filter(u => u.role === 'supervisor' && u.status === 'active');

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  function openUser(u: any) {
    setSelectedUser(u);
    setEditRole(u.role);
    setEditSup(u.supervisor_id ?? '');
    setEditStatus(u.status);
  }

  async function approveRequest(requestId: number) {
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

  async function submitDecline(e: React.FormEvent, requestId: number) {
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
        role: viewerRole === 'owner' ? editRole : undefined,
        supervisorId: editRole === 'consultant' ? (editSup || null) : null,
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

  const scope = (u: any) =>
    u.role === 'owner' ? 'Everything, including billing'
    : u.role === 'admin' ? 'Console only, no app access'
    : u.role === 'supervisor' ? 'Crew: ' + (u.crew ?? 'none')
    : 'Assigned Members' + (u.supervisor_name ? ' · reports to ' + shortName(u.supervisor_name) : '');

  return (
    <>
      {seatRequests.length > 0 && (
        <div className="frame strong" style={{ marginBottom: 4 }}>
          <div className="panel-head">
            <h2>Seat requests</h2>
            <span className="kicker">Admin invites when paid seats are full require Owner approval</span>
          </div>
          {seatRequests.map(sr => (
            <div key={sr.id} className="row" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between', cursor: 'default' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{sr.invite_email}</span>
                  <Pill kind="ink">{sr.invite_role}</Pill>
                  <Pill kind={sr.status === 'pending' ? 'unassigned' : sr.status === 'approved' ? 'verified' : 'overdue'}>{sr.status}</Pill>
                </div>
                <div className="kicker">
                  Requested by {sr.requested_by_name} on {fmtDate(sr.created_at)}
                  {sr.decided_by_name ? ` · ${sr.status} by ${sr.decided_by_name}` : ''}
                </div>
                {sr.decline_reason && (
                  <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 2 }}>
                    Reason: &ldquo;{sr.decline_reason}&rdquo;
                  </div>
                )}
              </div>

              {sr.status === 'pending' && viewerRole === 'owner' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  {decliningId === sr.id ? (
                    <form onSubmit={e => submitDecline(e, sr.id)} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        className="input"
                        value={declineReason}
                        onChange={e => setDeclineReason(e.target.value)}
                        placeholder="1-line reason for Admin…"
                        required
                        style={{ width: 220 }}
                      />
                      <button type="submit" className="btn btn-sm" style={{ color: 'var(--bad)' }} disabled={busy}>Confirm decline</button>
                      <button type="button" className="btn btn-sm" onClick={() => setDecliningId(null)}>Cancel</button>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => approveRequest(sr.id)}>
                        Approve &amp; buy seat
                      </button>
                      <button className="btn btn-sm" disabled={busy} onClick={() => { setDecliningId(sr.id); setDeclineReason(''); }}>
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

      <table className="tbl" style={{ minWidth: 780 }}>
        <thead><tr><th>Person</th><th>Role</th><th>Scope</th><th>Seat</th><th>Status</th></tr></thead>
        <tbody>
          {team.map(u => (
            <tr key={u.id} className="click" onClick={() => openUser(u)}>
              <td>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="avatar">{initials(u.name)}</span>
                  <span>
                    <span style={{ fontWeight: 500 }}>{u.name}</span>
                    <span className="sub">{u.email}</span>
                  </span>
                </span>
              </td>
              <td className="kicker" style={{ color: 'var(--ink)' }}>{u.role}</td>
              <td style={{ fontSize: 12.5, color: 'var(--n7)' }}>{scope(u)}</td>
              <td><Pill kind={u.role === 'admin' ? 'line' : 'ink'}>{u.role === 'admin' ? 'Free' : 'Paid seat'}</Pill></td>
              <td className="kicker" style={{ color: u.status === 'active' ? 'var(--ok)' : 'var(--warn7)' }}>{u.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedUser && (
        <>
          <div className="drawer-bg" onClick={() => setSelectedUser(null)} />
          <aside className="drawer" role="dialog" aria-label={selectedUser.name}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">{selectedUser.id} · {selectedUser.email}</div>
                <h2>{selectedUser.name}</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setSelectedUser(null)} aria-label="Close">×</button>
            </div>
            <form onSubmit={saveUser} className="drawer-body">
              <label className="field">
                <span>Role {viewerRole !== 'owner' ? '(Owner required to change roles)' : ''}</span>
                <select className="select" value={editRole} onChange={e => setEditRole(e.target.value)} disabled={viewerRole !== 'owner'}>
                  <option value="consultant">Consultant (paid seat)</option>
                  <option value="supervisor">Supervisor (paid seat)</option>
                  <option value="admin">Admin (free seat · console only)</option>
                  <option value="owner">Owner (paid seat · max 2)</option>
                </select>
              </label>

              {editRole === 'consultant' && (
                <label className="field">
                  <span>Reports to Supervisor (Crew assignment)</span>
                  <select className="select" value={editSup} onChange={e => setEditSup(e.target.value)}>
                    <option value="">— No Supervisor (direct to Admin/Owner) —</option>
                    {supervisors.filter(s => s.id !== selectedUser.id).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="field">
                <span>Account Status</span>
                <select className="select" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="invited">Invited</option>
                  <option value="suspended">Suspended (frees paid seat)</option>
                </select>
              </label>

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>Save team member</button>
                <button type="button" className="btn" onClick={() => setSelectedUser(null)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

