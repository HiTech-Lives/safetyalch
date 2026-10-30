'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type SubTab = 'who_is_free' | 'needs_staffing' | 'calendar' | 'placements' | 'time_away';

export default function AssignmentsManager({
  staff,
  unassignedJobs,
  unassignedVisits,
  allCerts,
  allJobs,
}: {
  staff: any[];
  unassignedJobs: any[];
  unassignedVisits: any[];
  allCerts: string[];
  allJobs: any[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const next7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [tab, setTab] = useState<SubTab>('who_is_free');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [requiredCerts, setRequiredCerts] = useState<string[]>([]);

  // Assign modal
  const [assignUser, setAssignUser] = useState<any | null>(null);
  const [selectedJobId, setSelectedJobId] = useState(unassignedJobs[0]?.id || allJobs[0]?.id || '');

  // Time away modal
  const [ptoUser, setPtoUser] = useState<any | null>(null);
  const [ptoStart, setPtoStart] = useState(today);
  const [ptoEnd, setPtoEnd] = useState(today);
  const [ptoReason, setPtoReason] = useState('');

  // Add certification modal
  const [certUser, setCertUser] = useState<any | null>(null);
  const [newCertCode, setNewCertCode] = useState('CSP');
  const [newCertExp, setNewCertExp] = useState(new Date(Date.now() + 730 * 86400000).toISOString().slice(0, 10));

  function toggleCert(code: string) {
    setRequiredCerts(prev => (prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]));
  }

  // Evaluate each consultant against date range & required certifications
  const evaluated = staff.map(u => {
    const validCerts: string[] = u.certifications
      .filter((c: any) => !c.expires_on || c.expires_on >= toDate)
      .map((c: any) => c.code);
    const missingCerts = requiredCerts.filter(rc => !validCerts.includes(rc));
    const overlappingVisits = u.scheduled_visits.filter(
      (v: any) => v.scheduled_for >= fromDate && v.scheduled_for <= toDate
    );
    const overlappingPto = u.time_away.filter(
      (t: any) => t.start_date <= toDate && t.end_date >= fromDate
    );
    const qualified = missingCerts.length === 0;
    const isFree = overlappingVisits.length === 0 && overlappingPto.length === 0;

    return {
      ...u,
      validCerts,
      missingCerts,
      overlappingVisits,
      overlappingPto,
      qualified,
      isFree,
    };
  });

  const qualifiedAndFree = evaluated.filter(u => u.qualified && u.isFree);
  const notFreeOrMissing = evaluated.filter(u => !u.qualified || !u.isFree);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignUser || !selectedJobId) return;
    await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'assign_job', user_id: assignUser.id, job_id: selectedJobId }),
    });
    setAssignUser(null);
    router.refresh();
  }

  async function handleSavePto(e: React.FormEvent) {
    e.preventDefault();
    if (!ptoUser) return;
    await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'add_time_away',
        user_id: ptoUser.id,
        start_date: ptoStart,
        end_date: ptoEnd,
        reason: ptoReason,
      }),
    });
    setPtoUser(null);
    router.refresh();
  }

  async function handleSaveCert(e: React.FormEvent) {
    e.preventDefault();
    if (!certUser) return;
    await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'add_certification',
        user_id: certUser.id,
        code: newCertCode,
        expires_on: newCertExp,
      }),
    });
    setCertUser(null);
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Sub-Navigation & Export Bar (Matches 01:40 in Video) */}
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(
              [
                ['who_is_free', `Who is free (${qualifiedAndFree.length})`],
                ['needs_staffing', `Needs staffing (${unassignedJobs.length + unassignedVisits.length})`],
                ['calendar', 'Calendar'],
                ['placements', 'Placements'],
                ['time_away', 'Time away'],
              ] as [SubTab, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={'btn btn-sm ' + (tab === k ? 'btn-primary' : '')}
                onClick={() => setTab(k)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-sm" onClick={() => window.print()}>
              Weekly schedule PDF
            </button>
          </div>
        </div>

        {/* Date & Certification Requirement Filter Bar (Matches 01:44 in Video) */}
        <div
          className="card-body"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            background: 'var(--bg-soft)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="kicker">From</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ fontSize: 12.5 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="kicker">To</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ fontSize: 12.5 }} />
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setFromDate(today);
                setToDate(today);
              }}
            >
              Today
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setFromDate(today);
                setToDate(next7);
              }}
            >
              Next 7 days
            </button>
          </div>

          <div>
            <div className="kicker" style={{ marginBottom: 6 }}>
              Job requires (must hold all selected &amp; remain valid through {toDate}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allCerts.map(c => {
                const active = requiredCerts.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCert(c)}
                    className={'btn btn-sm mono ' + (active ? 'btn-acc' : '')}
                    style={{ fontSize: 11.5 }}
                  >
                    {active ? '✓ ' : ''}
                    {c}
                  </button>
                );
              })}
              {requiredCerts.length > 0 && (
                <button type="button" className="btn btn-sm" onClick={() => setRequiredCerts([])}>
                  Clear cert filter
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {tab === 'who_is_free' && (
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Qualified & Free */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="card-title" style={{ color: 'var(--ok)' }}>
                  Qualified &amp; Free ({qualifiedAndFree.length})
                </span>
                <span className="chip ok">Ready to Dispatch</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {qualifiedAndFree.map(u => (
                  <div
                    key={u.id}
                    style={{
                      padding: 14,
                      border: '1px solid var(--line)',
                      background: 'var(--paper)',
                      borderRadius: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: 14 }}>{u.name}</strong>
                        <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                          {u.role.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="btn btn-sm btn-acc" onClick={() => setAssignUser(u)}>
                          Assign
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setCertUser(u)}>
                          + Cert
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setPtoUser(u)}>
                          Time away
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {u.certifications.map((c: any) => (
                        <span key={c.id} className="chip ok mono" style={{ fontSize: 10.5 }} title={`Expires ${c.expires_on}`}>
                          {c.code} (exp {c.expires_on.slice(0, 7)})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {qualifiedAndFree.length === 0 && (
                  <div className="muted" style={{ padding: 18 }}>
                    No consultants are both free and holding all selected certifications ({requiredCerts.join(', ')}) for this window.
                  </div>
                )}
              </div>
            </div>

            {/* Not Free / Missing Required Cert */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="card-title">Booked or Missing Required Credential ({notFreeOrMissing.length})</span>
                <span className="chip warn">Unavailable</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notFreeOrMissing.map(u => (
                  <div
                    key={u.id}
                    style={{
                      padding: 14,
                      border: '1px solid var(--line)',
                      background: 'var(--bg-soft)',
                      borderRadius: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: 14 }}>{u.name}</strong>
                        <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                          {u.role.toUpperCase()}
                        </span>
                      </div>
                      <button type="button" className="btn btn-sm" onClick={() => setCertUser(u)}>
                        + Add Cert
                      </button>
                    </div>

                    {u.overlappingVisits.map((v: any) => (
                      <div key={v.id} className="chip warn" style={{ alignSelf: 'flex-start' }}>
                        Booked {v.scheduled_for} ({v.start_time}): {v.member} — {v.site}
                      </div>
                    ))}
                    {u.overlappingPto.map((p: any) => (
                      <div key={p.id} className="chip danger" style={{ alignSelf: 'flex-start' }}>
                        Time away ({p.start_date} → {p.end_date}): {p.reason}
                      </div>
                    ))}
                    {u.missingCerts.length > 0 && (
                      <div className="chip danger mono" style={{ alignSelf: 'flex-start' }}>
                        Missing required: {u.missingCerts.join(', ')}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {u.certifications.map((c: any) => (
                        <span key={c.id} className="chip mono" style={{ fontSize: 10.5 }}>
                          {c.code}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'needs_staffing' && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Unassigned Job / Visit</th>
                  <th>Policyholder &amp; Site</th>
                  <th>Service</th>
                  <th>Target Due Date</th>
                  <th>Fee</th>
                  <th>Assign Qualified Consultant</th>
                </tr>
              </thead>
              <tbody>
                {unassignedJobs.map(j => (
                  <tr key={j.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {j.id} · {j.carrier_ref || 'Direct'}
                    </td>
                    <td>
                      <strong>{j.insured_name}</strong>
                      <div className="muted" style={{ fontSize: 11.5 }}>{j.site_address}</div>
                    </td>
                    <td>{j.service_type}</td>
                    <td className="mono">{j.due_date || '—'}</td>
                    <td className="mono">${Number(j.fee).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-acc"
                        onClick={() => {
                          setSelectedJobId(j.id);
                          setAssignUser(qualifiedAndFree[0] || staff[0]);
                        }}
                      >
                        Dispatch Consultant →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(tab === 'calendar' || tab === 'placements') && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Consultant</th>
                  <th>Active Credentials</th>
                  <th>Scheduled Route Visits</th>
                  <th>Active Work Queue Placements</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(u => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                      <div className="muted" style={{ fontSize: 11.5 }}>{u.email}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {u.certifications.map((c: any) => (
                          <span key={c.id} className="chip ok mono" style={{ fontSize: 10.5 }}>
                            {c.code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {u.scheduled_visits.map((v: any) => (
                        <div key={v.id} style={{ fontSize: 12, marginBottom: 4 }}>
                          <span className="mono">{v.scheduled_for}</span> · <strong>{v.member}</strong> ({v.site})
                        </div>
                      ))}
                    </td>
                    <td>
                      {u.active_jobs.map((j: any) => (
                        <div key={j.id} style={{ fontSize: 12, marginBottom: 4 }}>
                          <span className="mono">{j.id}</span> · {j.title}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'time_away' && (
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="card-title">Consultant PTO &amp; Conference Blocks</span>
              <button type="button" className="btn btn-sm btn-acc" onClick={() => setPtoUser(staff[0])}>
                + Log Time Away
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Consultant</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {staff.flatMap(u =>
                  u.time_away.map((t: any) => (
                    <tr key={t.id}>
                      <td><strong>{u.name}</strong></td>
                      <td className="mono">{t.start_date}</td>
                      <td className="mono">{t.end_date}</td>
                      <td>{t.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Drawer */}
      {assignUser && (
        <div className="scrim" onClick={() => setAssignUser(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div className="kicker">Dispatch Qualified Consultant</div>
                <div style={{ font: '700 20px var(--fh)', textTransform: 'uppercase' }}>Assign {assignUser.name}</div>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setAssignUser(null)}>
                Close ✕
              </button>
            </div>
            <form onSubmit={handleAssign} className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label>Select Work Queue Job</label>
                <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}>
                  {allJobs.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.id} · {j.title} ({j.insured_name})
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-acc">
                Confirm Assignment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Time Away Drawer */}
      {ptoUser && (
        <div className="scrim" onClick={() => setPtoUser(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div className="kicker">Availability Calendar</div>
                <div style={{ font: '700 20px var(--fh)', textTransform: 'uppercase' }}>Log Time Away · {ptoUser.name}</div>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setPtoUser(null)}>
                Close ✕
              </button>
            </div>
            <form onSubmit={handleSavePto} className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field">
                  <label>Start Date</label>
                  <input type="date" value={ptoStart} onChange={e => setPtoStart(e.target.value)} />
                </div>
                <div className="field">
                  <label>End Date</label>
                  <input type="date" value={ptoEnd} onChange={e => setPtoEnd(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Reason</label>
                <input
                  type="text"
                  value={ptoReason}
                  onChange={e => setPtoReason(e.target.value)}
                  placeholder="e.g. ASSP Conference / PTO"
                />
              </div>
              <button type="submit" className="btn btn-acc">
                Save Time Away
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Certification Drawer */}
      {certUser && (
        <div className="scrim" onClick={() => setCertUser(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div className="kicker">Credential Compliance</div>
                <div style={{ font: '700 20px var(--fh)', textTransform: 'uppercase' }}>Add Credential · {certUser.name}</div>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setCertUser(null)}>
                Close ✕
              </button>
            </div>
            <form onSubmit={handleSaveCert} className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label>Certification / Designation</label>
                <select value={newCertCode} onChange={e => setNewCertCode(e.target.value)}>
                  {allCerts.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Expiration Date</label>
                <input type="date" value={newCertExp} onChange={e => setNewCertExp(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-acc">
                Add Certification
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

