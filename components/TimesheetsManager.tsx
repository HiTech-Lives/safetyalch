'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type StatusTab = 'waiting' | 'approved' | 'sent_back' | 'all' | 'expenses';

export default function TimesheetsManager({
  timesheets,
  expenses,
}: {
  timesheets: any[];
  expenses: any[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>('waiting');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredTs = timesheets.filter(ts => (tab === 'all' || tab === 'expenses' ? true : ts.status === tab));

  function toggleSelect(id: string) {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  async function updateStatus(ids: string[], status: 'approved' | 'sent_back') {
    if (!ids.length) return;
    await fetch('/api/timesheets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update_timesheet_status', ids, status }),
    });
    setSelectedIds([]);
    router.refresh();
  }

  async function updateExpenseStatus(id: string, status: 'approved' | 'sent_back') {
    await fetch('/api/timesheets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update_expense_status', id, status }),
    });
    router.refresh();
  }

  // Exact Billing CSV Export from 06:05 in Safely Track Video:
  // "Client, Site, Person, Week start, Internal sheet hours, Internal overtime, Client sheet hours, Difference, Client sheet, Signed by, Signed on, How signed, Timesheet status"
  function exportBillingCSV() {
    const headers = [
      'Client',
      'Site',
      'Person',
      'Week start',
      'Internal sheet hours',
      'Internal overtime',
      'Client sheet hours',
      'Difference',
      'Client sheet',
      'Signed by',
      'Signed on',
      'How signed',
      'Timesheet status',
    ];
    const rows: string[][] = [];
    for (const ts of timesheets) {
      for (const e of ts.entries || []) {
        const internalHrs =
          Number(e.mon_hrs) +
          Number(e.tue_hrs) +
          Number(e.wed_hrs) +
          Number(e.thu_hrs) +
          Number(e.fri_hrs) +
          Number(e.sat_hrs) +
          Number(e.sun_hrs);
        const clientHrs = e.client_sheet_hours !== null ? Number(e.client_sheet_hours) : internalHrs;
        const diff = internalHrs - clientHrs;
        rows.push([
          `"${e.member_name || ''}"`,
          `"${e.site_name || 'Primary Site'}"`,
          `"${ts.user_name}"`,
          ts.week_start,
          internalHrs.toFixed(2),
          ts.overtime_hours.toFixed(2),
          clientHrs.toFixed(2),
          diff.toFixed(2),
          ts.policyholder_signed_by ? 'Verified' : 'Internal only',
          `"${ts.policyholder_signed_by || ts.user_name}"`,
          ts.policyholder_signed_at || ts.employee_signed_at || '',
          `"${ts.policyholder_signature_method || 'Electronic'}"`,
          ts.status,
        ]);
      }
    }
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safety-alchemist-billing-timesheets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  function exportPayrollCSV() {
    const headers = ['Employee', 'Email', 'Role', 'Week Start', 'Regular Hours', 'Overtime Hours', 'Total Hours', 'Status', 'Signed At'];
    const rows = timesheets.map(ts => [
      `"${ts.user_name}"`,
      ts.user_email,
      ts.user_role,
      ts.week_start,
      Math.min(40, ts.total_hours).toFixed(2),
      ts.overtime_hours.toFixed(2),
      ts.total_hours.toFixed(2),
      ts.status,
      ts.employee_signed_at || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safety-alchemist-payroll-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi">
          <div className="kicker">Waiting Approval</div>
          <div className="kpi-num" style={{ color: 'var(--warn)' }}>
            {timesheets.filter(t => t.status === 'waiting').length}
          </div>
          <div className="kpi-sub">Signed weekly timesheets</div>
        </div>
        <div className="kpi">
          <div className="kicker">Approved Timesheets</div>
          <div className="kpi-num" style={{ color: 'var(--ok)' }}>
            {timesheets.filter(t => t.status === 'approved').length}
          </div>
          <div className="kpi-sub">Ready for Payroll &amp; Billing CSV</div>
        </div>
        <div className="kpi">
          <div className="kicker">Total Logged Hours</div>
          <div className="kpi-num mono">
            {timesheets.reduce((s, t) => s + Number(t.total_hours), 0).toFixed(1)}h
          </div>
          <div className="kpi-sub">Across active engagements</div>
        </div>
        <div className="kpi">
          <div className="kicker">Field Expenses Waiting</div>
          <div className="kpi-num mono">
            ${expenses.filter(e => e.status === 'waiting').reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}
          </div>
          <div className="kpi-sub">{expenses.length} receipts &amp; mileage logs</div>
        </div>
      </div>

      {/* Approval Toolbar & CSV Exports (Matches 06:00 - 06:09 in Video) */}
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(
              [
                ['waiting', `Waiting (${timesheets.filter(t => t.status === 'waiting').length})`],
                ['approved', `Approved (${timesheets.filter(t => t.status === 'approved').length})`],
                ['sent_back', `Sent back (${timesheets.filter(t => t.status === 'sent_back').length})`],
                ['all', `All Timesheets (${timesheets.length})`],
                ['expenses', `Expenses & Receipts (${expenses.length})`],
              ] as [StatusTab, string][]
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

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-acc"
                  onClick={() => updateStatus(selectedIds, 'approved')}
                >
                  Approve Selected ({selectedIds.length})
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => updateStatus(selectedIds, 'sent_back')}
                >
                  Send Back ({selectedIds.length})
                </button>
              </>
            )}
            <button type="button" className="btn btn-sm" onClick={exportPayrollCSV}>
              Payroll CSV ↓
            </button>
            <button type="button" className="btn btn-sm btn-acc" onClick={exportBillingCSV}>
              Billing CSV (1 Row / Client &amp; Site) ↓
            </button>
          </div>
        </div>

        {tab !== 'expenses' ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === filteredTs.length}
                      onChange={e =>
                        setSelectedIds(e.target.checked ? filteredTs.map(t => t.id) : [])
                      }
                    />
                  </th>
                  <th>Consultant</th>
                  <th>Week Start</th>
                  <th>Client &amp; Site Breakdown</th>
                  <th>Internal Hours / OT</th>
                  <th>Policyholder Sign-Off</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTs.map(ts => (
                  <tr key={ts.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(ts.id)}
                        onChange={() => toggleSelect(ts.id)}
                      />
                    </td>
                    <td>
                      <strong>{ts.user_name}</strong>
                      <div className="muted" style={{ fontSize: 11.5 }}>{ts.user_role.toUpperCase()}</div>
                    </td>
                    <td className="mono">{ts.week_start}</td>
                    <td>
                      {(ts.entries || []).map((e: any) => {
                        const rowHrs =
                          e.mon_hrs + e.tue_hrs + e.wed_hrs + e.thu_hrs + e.fri_hrs + e.sat_hrs + e.sun_hrs;
                        return (
                          <div key={e.id} style={{ fontSize: 12.5, marginBottom: 4 }}>
                            <strong>{e.member_name}</strong> ({e.site_name || 'Main Site'}) —{' '}
                            <span className="mono">{rowHrs.toFixed(1)}h</span>
                            {e.carrier_ref && <span className="muted mono"> [{e.carrier_ref}]</span>}
                          </div>
                        );
                      })}
                    </td>
                    <td className="mono">
                      <div><strong>{ts.total_hours.toFixed(2)} hrs</strong></div>
                      {ts.overtime_hours > 0 && (
                        <div style={{ color: 'var(--warn)', fontSize: 11 }}>OT: {ts.overtime_hours.toFixed(2)} hrs</div>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {ts.policyholder_signed_by ? (
                        <div>
                          <span className="chip ok">Signed ✓</span>
                          <div style={{ marginTop: 4 }}>{ts.policyholder_signed_by}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{ts.policyholder_signature_method}</div>
                        </div>
                      ) : (
                        <span className="muted">Employee signed only</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          'chip ' +
                          (ts.status === 'approved' ? 'ok' : ts.status === 'sent_back' ? 'danger' : 'warn')
                        }
                      >
                        {ts.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {ts.status !== 'approved' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-acc"
                            onClick={() => updateStatus([ts.id], 'approved')}
                          >
                            Approve
                          </button>
                        )}
                        {ts.status !== 'sent_back' && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => updateStatus([ts.id], 'sent_back')}
                          >
                            Send back
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Consultant</th>
                  <th>Date</th>
                  <th>Merchant / Description</th>
                  <th>Category</th>
                  <th>Program &amp; Job</th>
                  <th>Billable</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(ex => (
                  <tr key={ex.id}>
                    <td><strong>{ex.user_name}</strong></td>
                    <td className="mono">{ex.expense_date}</td>
                    <td>
                      <strong>{ex.merchant}</strong>
                      {ex.notes && <div className="muted" style={{ fontSize: 11.5 }}>{ex.notes}</div>}
                    </td>
                    <td className="mono">{ex.category}</td>
                    <td style={{ fontSize: 12 }}>{ex.job_title || ex.program_title || 'General'}</td>
                    <td>{ex.billable ? <span className="chip ok">Billable</span> : <span className="chip">Internal</span>}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>${Number(ex.amount).toFixed(2)}</td>
                    <td>
                      <span className={'chip ' + (ex.status === 'approved' ? 'ok' : 'warn')}>{ex.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {ex.status !== 'approved' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-acc"
                            onClick={() => updateExpenseStatus(ex.id, 'approved')}
                          >
                            Approve
                          </button>
                        )}
                        {ex.status !== 'sent_back' && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => updateExpenseStatus(ex.id, 'sent_back')}
                          >
                            Send back
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

