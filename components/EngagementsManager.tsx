'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ViewTab = 'status' | 'by_policyholder' | 'by_source' | 'by_referral' | 'end_of_year' | 'audits';

export default function EngagementsManager({
  engagements,
  sources,
  referrals,
  members,
}: {
  engagements: any[];
  sources: any[];
  referrals: any[];
  members: any[];
}) {
  const router = useRouter();
  const [view, setView] = useState<ViewTab>('status');
  const [selectedEng, setSelectedEng] = useState<any | null>(engagements[0] || null);
  const [newEngModal, setNewEngModal] = useState(false);
  const [logModalEng, setLogModalEng] = useState<any | null>(null);
  const [activityNote, setActivityNote] = useState('');

  // New Engagement fields
  const [title, setTitle] = useState('');
  const [sourceId, setSourceId] = useState(sources[0]?.id || '');
  const [referralId, setReferralId] = useState(referrals[0]?.id || '');
  const [memberId, setMemberId] = useState(members[0]?.id || '');
  const [billingModel, setBillingModel] = useState<'drawdown' | 'fixed_deliverable' | 'hourly'>('drawdown');
  const [annualBudget, setAnnualBudget] = useState('90000');
  const [deliverablesTotal, setDeliverablesTotal] = useState('24');

  // Book of business rollups (matches 01:08 in video)
  const totalInForce = engagements.reduce((s, e) => s + Number(e.annual_budget), 0);
  const totalBilled = engagements.reduce((s, e) => s + Number(e.billed_amount), 0);
  const totalDeliv = engagements.reduce((s, e) => s + Number(e.deliverables_total), 0);
  const doneDeliv = engagements.reduce((s, e) => s + Number(e.deliverables_done), 0);
  const delivPct = totalDeliv > 0 ? Math.round((doneDeliv / totalDeliv) * 100) : 0;
  const unbilledTotal = engagements.reduce((s, e) => s + Number(e.unbilled_delivered_amount || 0), 0);
  const unbilledPct = totalInForce > 0 ? Math.round((unbilledTotal / totalInForce) * 100) : 0;
  const behindCount = engagements.filter(e => e.status === 'behind').length;
  const quietCount = engagements.filter(e => e.status === 'gone_quiet').length;

  function exportCSV() {
    const headers = [
      'Engagement ID',
      'Program Title',
      'Source',
      'Source Type',
      'Referral / Program Manager',
      'Policyholder',
      'Billing Model',
      'Annual Budget',
      'Spent To Date',
      'Planned',
      'Billed',
      'Deliverables Done/Total',
      'Status',
    ];
    const rows = engagements.map(e => [
      e.id,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${e.source_name || 'Direct'}"`,
      e.source_type || 'commercial',
      `"${e.referral_name || ''}"`,
      `"${e.member_name || ''}"`,
      e.billing_model,
      e.annual_budget.toFixed(2),
      e.spent_to_date.toFixed(2),
      e.planned_amount.toFixed(2),
      e.billed_amount.toFixed(2),
      `${e.deliverables_done}/${e.deliverables_total}`,
      e.status,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safety-alchemist-engagements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  async function handleCreateEngagement(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/engagements', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create_engagement',
        title,
        source_id: sourceId,
        referral_source_id: referralId,
        member_id: memberId,
        billing_model: billingModel,
        annual_budget: Number(annualBudget),
        deliverables_total: Number(deliverablesTotal),
      }),
    });
    setNewEngModal(false);
    router.refresh();
  }

  async function handleLogActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!logModalEng) return;
    await fetch('/api/engagements', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'log_activity',
        id: logModalEng.id,
        note: activityNote,
      }),
    });
    setLogModalEng(null);
    setActivityNote('');
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Book-of-Business KPIs (Matches 01:08 in Video) */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="kpi">
          <div className="kicker">In Force</div>
          <div className="kpi-num mono" style={{ fontSize: 22 }}>
            ${totalInForce.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="kpi-sub">{engagements.length} active programs</div>
        </div>
        <div className="kpi">
          <div className="kicker">Deliverables Completed</div>
          <div className="kpi-num">{delivPct}%</div>
          <div className="kpi-sub">
            {doneDeliv} of {totalDeliv} visits delivered
          </div>
        </div>
        <div className="kpi">
          <div className="kicker">Delivered, Unbilled</div>
          <div className="kpi-num" style={{ color: 'var(--warn)' }}>
            {unbilledPct}%
          </div>
          <div className="kpi-sub">${unbilledTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ready to invoice</div>
        </div>
        <div className="kpi">
          <div className="kicker">Billed</div>
          <div className="kpi-num mono" style={{ fontSize: 22, color: 'var(--ok)' }}>
            ${totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="kpi-sub">Invoiced to carriers &amp; captives</div>
        </div>
        <div className="kpi">
          <div className="kicker">Behind / Gone Quiet</div>
          <div className="kpi-num" style={{ color: 'var(--danger)' }}>
            {behindCount} / {quietCount}
          </div>
          <div className="kpi-sub">Needs outreach or scheduling</div>
        </div>
      </div>

      {/* Featured Program Draw-Down Budget Card (Matches 05:41 in Video) */}
      {selectedEng && (
        <div className="card" style={{ border: '2px solid var(--ink)' }}>
          <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="kicker">
                {selectedEng.source_name || 'Direct'} {selectedEng.referral_name ? `→ ${selectedEng.referral_name}` : ''} ·{' '}
                {selectedEng.billing_model.toUpperCase()} PROGRAM
              </div>
              <span className="card-title" style={{ fontSize: 18 }}>
                {selectedEng.title}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" className="btn btn-sm" onClick={() => setLogModalEng(selectedEng)}>
                Log activity
              </button>
              <span className={'chip ' + (selectedEng.status === 'on_pace' ? 'ok' : 'warn')}>
                {selectedEng.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {(() => {
              const budget = Number(selectedEng.annual_budget || 90000);
              const spent = Number(selectedEng.spent_to_date || 0);
              const planned = Number(selectedEng.planned_amount || 0);
              const left = Math.max(0, budget - spent - planned);
              const spentPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
              const plannedPct = budget > 0 ? Math.round((planned / budget) * 100) : 0;
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div style={{ padding: 12, background: 'var(--bg-soft)', border: '1px solid var(--line)' }}>
                      <div className="kicker">Annual Budget</div>
                      <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
                        ${budget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div style={{ padding: 12, background: 'var(--bg-soft)', border: '1px solid var(--line)' }}>
                      <div className="kicker">Spent To Date</div>
                      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ok)' }}>
                        ${spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div style={{ padding: 12, background: 'var(--bg-soft)', border: '1px solid var(--line)' }}>
                      <div className="kicker">Planned</div>
                      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--warn)' }}>
                        ${planned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div style={{ padding: 12, background: 'var(--bg-soft)', border: '1px solid var(--line)' }}>
                      <div className="kicker">Projected Left</div>
                      <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
                        ${left.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Pacing Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }} className="mono">
                      <span>
                        Spent {spentPct}% · Planned {plannedPct}% · Projected Left {Math.max(0, 100 - spentPct - plannedPct)}%
                      </span>
                      <span>79% of contract term elapsed ({selectedEng.start_date} → {selectedEng.end_date})</span>
                    </div>
                    <div style={{ height: 12, background: 'var(--line)', display: 'flex', overflow: 'hidden', borderRadius: 2 }}>
                      <div style={{ width: `${Math.min(100, spentPct)}%`, background: 'var(--ok)' }} title="Spent to date" />
                      <div style={{ width: `${Math.min(100 - spentPct, plannedPct)}%`, background: 'var(--warn)' }} title="Planned" />
                    </div>
                  </div>

                  {/* Service Plan Table (Matches 05:45 in Video) */}
                  {selectedEng.service_lines?.length > 0 && (
                    <div>
                      <div className="kicker" style={{ marginBottom: 8 }}>
                        Program Service Plan &amp; Draw-Down Breakdown
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Service / Work Type</th>
                              <th>Done / Planned</th>
                              <th>Each</th>
                              <th>Planned ($)</th>
                              <th>Spent ($)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedEng.service_lines.map((line: any) => (
                              <tr key={line.id}>
                                <td style={{ fontWeight: 600 }}>{line.service_name}</td>
                                <td className="mono">
                                  {line.done_count ?? 0} / {line.planned_count ?? 0}{' '}
                                  {line.unit_type === 'hourly' ? 'hrs' : line.unit_type === 'fixed_fee' ? 'visits' : ''}
                                </td>
                                <td className="mono">
                                  {line.rate_each
                                    ? `$${Number(line.rate_each).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                    : '—'}
                                </td>
                                <td className="mono">
                                  ${Number(line.planned_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="mono" style={{ fontWeight: 600 }}>
                                  ${Number(line.spent_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Multi-View Engagements Directory (Matches 01:12 - 01:38 in Video) */}
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(
              [
                ['status', 'Status'],
                ['by_policyholder', 'By policyholder'],
                ['by_source', 'By source (Carrier / Captive)'],
                ['by_referral', 'By referral source (Broker)'],
                ['end_of_year', 'End of year'],
                ['audits', 'Audits and meetings'],
              ] as [ViewTab, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={'btn btn-sm ' + (view === k ? 'btn-primary' : '')}
                onClick={() => setView(k)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm" onClick={exportCSV}>
              Export CSV
            </button>
            <button type="button" className="btn btn-sm" onClick={() => window.print()}>
              Export PDF
            </button>
            <button type="button" className="btn btn-sm btn-acc" onClick={() => setNewEngModal(true)}>
              + New engagement
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Program / Engagement</th>
                <th>3-Tier Chain (Source → Broker → Policyholder)</th>
                <th>Model</th>
                <th>Deliverables</th>
                <th>Annual Budget</th>
                <th>Spent / Billed</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {engagements
                .slice()
                .sort((a, b) => {
                  if (view === 'by_policyholder') return (a.member_name || '').localeCompare(b.member_name || '');
                  if (view === 'by_source') return (a.source_name || '').localeCompare(b.source_name || '');
                  if (view === 'by_referral') return (a.referral_name || '').localeCompare(b.referral_name || '');
                  if (view === 'end_of_year') return (a.end_date || '').localeCompare(b.end_date || '');
                  return 0;
                })
                .map(eng => (
                  <tr
                    key={eng.id}
                    style={{
                      background: selectedEng?.id === eng.id ? 'var(--bg-soft)' : undefined,
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedEng(eng)}
                  >
                    <td>
                      <div style={{ fontWeight: 700 }}>{eng.title}</div>
                      <div className="mono muted" style={{ fontSize: 11 }}>
                        Term: {eng.start_date} → {eng.end_date}
                      </div>
                    </td>
                    <td style={{ fontSize: 12.5 }}>
                      <div>
                        <strong>{eng.source_name || 'Direct Commercial'}</strong>{' '}
                        <span className="chip" style={{ fontSize: 10 }}>
                          {eng.source_type || 'commercial'}
                        </span>
                      </div>
                      {eng.referral_name && <div className="muted">Broker / PM: {eng.referral_name}</div>}
                      {eng.member_name && <div className="muted">Policyholder: {eng.member_name}</div>}
                    </td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {eng.billing_model}
                    </td>
                    <td className="mono">
                      {eng.deliverables_done} / {eng.deliverables_total}
                    </td>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      ${eng.annual_budget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      <div>Spent: ${eng.spent_to_date.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                      <div className="muted">Billed: ${eng.billed_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    </td>
                    <td>
                      <span
                        className={
                          'chip ' +
                          (eng.status === 'on_pace' ? 'ok' : eng.status === 'behind' || eng.status === 'gone_quiet' ? 'danger' : '')
                        }
                      >
                        {eng.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={ev => {
                          ev.stopPropagation();
                          setSelectedEng(eng);
                        }}
                      >
                        Budget Plan →
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Engagement Drawer */}
      {newEngModal && (
        <div className="scrim" onClick={() => setNewEngModal(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div className="kicker">Book of Business</div>
                <div style={{ font: '700 20px var(--fh)', textTransform: 'uppercase' }}>New Loss Control Engagement</div>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setNewEngModal(false)}>
                Close ✕
              </button>
            </div>
            <form onSubmit={handleCreateEngagement} className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label>Program / Engagement Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Golden State Contractors Captive · FY27 Draw-Down Program"
                />
              </div>
              <div className="field">
                <label>Source (Carrier / Captive / Commercial)</label>
                <select value={sourceId} onChange={e => setSourceId(e.target.value)}>
                  {sources.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.source_type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Referral Source / Program Manager (Optional)</label>
                <select value={referralId} onChange={e => setReferralId(e.target.value)}>
                  <option value="">— Direct / No Broker —</option>
                  {referrals.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.contact_name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Primary Policyholder / Member</label>
                <select value={memberId} onChange={e => setMemberId(e.target.value)}>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.city})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div className="field">
                  <label>Billing Model</label>
                  <select value={billingModel} onChange={e => setBillingModel(e.target.value as any)}>
                    <option value="drawdown">Annual Draw-Down</option>
                    <option value="fixed_deliverable">Fixed Deliverable</option>
                    <option value="hourly">Hourly T&amp;M</option>
                  </select>
                </div>
                <div className="field">
                  <label>Annual Budget ($)</label>
                  <input type="number" value={annualBudget} onChange={e => setAnnualBudget(e.target.value)} className="mono" />
                </div>
                <div className="field">
                  <label>Planned Deliverables</label>
                  <input type="number" value={deliverablesTotal} onChange={e => setDeliverablesTotal(e.target.value)} className="mono" />
                </div>
              </div>
              <button type="submit" className="btn btn-acc">
                Create Engagement &amp; Service Plan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Log Activity Modal */}
      {logModalEng && (
        <div className="scrim" onClick={() => setLogModalEng(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div className="kicker">Engagement Touchpoint</div>
                <div style={{ font: '700 20px var(--fh)', textTransform: 'uppercase' }}>Log Program Activity</div>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setLogModalEng(null)}>
                Close ✕
              </button>
            </div>
            <form onSubmit={handleLogActivity} className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontWeight: 600 }}>{logModalEng.title}</div>
              <div className="field">
                <label>Stewardship / Audit / Outreach Note</label>
                <textarea
                  rows={4}
                  required
                  value={activityNote}
                  onChange={e => setActivityNote(e.target.value)}
                  placeholder="e.g. Conducted quarterly captive stewardship call with Megan Holt at Westline Risk Partners..."
                />
              </div>
              <button type="submit" className="btn btn-acc">
                Save Activity &amp; Mark On Pace
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

