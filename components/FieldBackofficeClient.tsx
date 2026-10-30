'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

type MobileTab = 'my_jobs' | 'expenses' | 'timesheets';

export default function FieldBackofficeClient({
  jobs,
  engagements,
  members,
  expenses,
  timesheets,
  userName,
}: {
  jobs: any[];
  engagements: any[];
  members: any[];
  expenses: any[];
  timesheets: any[];
  userName: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<MobileTab>('my_jobs');

  // Expense form state (Matches 05:10 - 05:38 in Video)
  const [expMode, setExpMode] = useState<'receipt' | 'mileage'>('receipt');
  const [merchant, setMerchant] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<'lodging' | 'meals' | 'mileage' | 'airfare' | 'supplies' | 'other'>('lodging');
  const [amount, setAmount] = useState('');
  const [miles, setMiles] = useState('94');
  const [expProgramId, setExpProgramId] = useState(engagements[0]?.id || '');
  const [expJobId, setExpJobId] = useState(jobs[0]?.id || '');
  const [billable, setBillable] = useState(true);
  const [expNotes, setExpNotes] = useState('');
  const [ocrReading, setOcrReading] = useState(false);
  const [ocrModelBadge, setOcrModelBadge] = useState('');
  const [savingExp, setSavingExp] = useState(false);

  // Timesheet state (Matches 05:48 - 06:00 in Video)
  const [weekStart, setWeekStart] = useState(new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10));
  const [tsRows, setTsRows] = useState([
    {
      member_id: 'm8',
      site_id: 's13',
      job_id: 'J-1001',
      label: 'Cal Plains Roofing · Post-incident review (GSC-WC-26-0412)',
      mon_hrs: 0,
      tue_hrs: 0,
      wed_hrs: 4.5,
      thu_hrs: 6.0,
      fri_hrs: 3.5,
      sat_hrs: 0,
      sun_hrs: 0,
    },
    {
      member_id: 'm2',
      site_id: 's4',
      job_id: 'J-1002',
      label: 'Valley Crest Farms · Annual Ag Survey (PAM-AG-26-1108)',
      mon_hrs: 8.0,
      tue_hrs: 8.5,
      wed_hrs: 4.0,
      thu_hrs: 2.0,
      fri_hrs: 2.0,
      sat_hrs: 0,
      sun_hrs: 0,
    },
  ]);
  const [policyholderSignedBy, setPolicyholderSignedBy] = useState('Jorge Medina (Cal Plains Roofing)');
  const [sigMode, setSigMode] = useState<'draw' | 'upload'>('draw');
  const [sigDrawn, setSigDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [submittingTs, setSubmittingTs] = useState(false);

  // Expense KPIs
  const waitingExp = expenses.filter(e => e.status === 'waiting').reduce((s, e) => s + Number(e.amount), 0);
  const approvedExp = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + Number(e.amount), 0);
  const billableExp = expenses.filter(e => e.billable).reduce((s, e) => s + Number(e.amount), 0);

  async function handleSnapReceipt(fileName: string, hintText: string) {
    setOcrReading(true);
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'parse_receipt', fileName, hintText }),
    });
    const data = await res.json();
    setOcrReading(false);
    if (data.ok && data.receipt) {
      setMerchant(data.receipt.merchant);
      setExpenseDate(data.receipt.expense_date);
      setAmount(String(data.receipt.amount));
      setCategory(data.receipt.category);
      setExpNotes(data.receipt.notes);
      setOcrModelBadge(data.receipt.model_used || 'aws_bedrock:qwen.qwen2.5-vl-72b-instruct');
    }
  }

  async function handleSaveExpense(e: React.FormEvent) {
    e.preventDefault();
    setSavingExp(true);
    const finalAmount = expMode === 'mileage' ? Number((Number(miles || 0) * 0.67).toFixed(2)) : Number(amount || 0);
    const selectedJobObj = jobs.find(j => j.id === expJobId);
    await fetch('/api/timesheets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create_expense',
        engagement_id: expProgramId || null,
        job_id: expJobId || null,
        member_id: selectedJobObj?.member_id || members[0]?.id,
        expense_date: expenseDate,
        merchant: expMode === 'mileage' ? `IRS Standard Mileage (${miles} mi @ $0.67)` : merchant,
        category: expMode === 'mileage' ? 'mileage' : category,
        amount: finalAmount,
        miles: expMode === 'mileage' ? Number(miles) : null,
        billable,
        notes: expNotes,
      }),
    });
    setSavingExp(false);
    setMerchant('');
    setAmount('');
    router.refresh();
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const rect = c.getBoundingClientRect();
    ctx.strokeStyle = '#141619';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setDrawing(true);
    setSigDrawn(true);
  }

  function moveDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const rect = c.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }

  function clearCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, c.width, c.height);
    setSigDrawn(false);
  }

  async function handleSignAndSendTimesheet(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingTs(true);
    const sigData =
      sigDrawn && canvasRef.current
        ? canvasRef.current.toDataURL('image/png')
        : `Signed electronically: ${userName}`;

    await fetch('/api/timesheets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'submit_timesheet',
        week_start: weekStart,
        entries: tsRows,
        employee_signature_data: sigData,
        policyholder_signed_by: policyholderSignedBy,
        policyholder_signature_method: 'On-glass mobile sign-off',
      }),
    });
    setSubmittingTs(false);
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Mobile End-of-Day Tab Switcher (Matches 04:53 in Video: My jobs | Expenses | Timesheets) */}
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={'btn ' + (tab === 'my_jobs' ? 'btn-acc' : '')}
              onClick={() => setTab('my_jobs')}
            >
              My jobs ({jobs.length})
            </button>
            <button
              type="button"
              className={'btn ' + (tab === 'expenses' ? 'btn-acc' : '')}
              onClick={() => setTab('expenses')}
            >
              Expenses ({expenses.length})
            </button>
            <button
              type="button"
              className={'btn ' + (tab === 'timesheets' ? 'btn-acc' : '')}
              onClick={() => setTab('timesheets')}
            >
              Timesheets ({timesheets.length})
            </button>
          </div>
          <Link href="/timesheets" className="btn btn-sm">
            Office Timesheet Approvals &amp; Billing CSV →
          </Link>
        </div>
      </div>

      {/* TAB 1: MY JOBS */}
      {tab === 'my_jobs' && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Assigned &amp; Delivered Jobs</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job / Carrier Ref</th>
                  <th>Policyholder &amp; Site</th>
                  <th>Program</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Field Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {j.id} · {j.carrier_ref || 'Direct'}
                    </td>
                    <td>
                      <strong>{j.insured_name}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>{j.site_address}</div>
                    </td>
                    <td style={{ fontSize: 12.5 }}>{j.program_title || 'Direct Commercial'}</td>
                    <td className="mono">${Number(j.fee).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={'chip ' + (j.status === 'delivered' ? 'ok' : 'warn')}>{j.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link href={`/field/capture?job=${j.id}&member=${j.member_id}`} className="btn btn-sm">
                          Capture
                        </Link>
                        <Link href={`/field/quick-report?job=${j.id}&member=${j.member_id}`} className="btn btn-sm btn-acc">
                          Quick Report
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: EXPENSES & RECEIPT OCR (Matches 05:10 - 05:38 in Video) */}
      {tab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="kpi">
              <div className="kicker">Waiting Approval</div>
              <div className="kpi-num mono">${waitingExp.toFixed(2)}</div>
              <div className="kpi-sub">Submitted field receipts &amp; mileage</div>
            </div>
            <div className="kpi">
              <div className="kicker">Approved</div>
              <div className="kpi-num mono" style={{ color: 'var(--ok)' }}>
                ${approvedExp.toFixed(2)}
              </div>
              <div className="kpi-sub">Cleared for reimbursement</div>
            </div>
            <div className="kpi">
              <div className="kicker">Billable to Customer</div>
              <div className="kpi-num mono" style={{ color: 'var(--acc)' }}>
                ${billableExp.toFixed(2)}
              </div>
              <div className="kpi-sub">Applies to program draw-down</div>
            </div>
          </div>

          <form onSubmit={handleSaveExpense} className="card">
            <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={'btn btn-sm ' + (expMode === 'receipt' ? 'btn-primary' : '')}
                  onClick={() => setExpMode('receipt')}
                >
                  Snap Receipt (AI OCR)
                </button>
                <button
                  type="button"
                  className={'btn btn-sm ' + (expMode === 'mileage' ? 'btn-primary' : '')}
                  onClick={() => setExpMode('mileage')}
                >
                  Mileage Calculator ($0.67/mi)
                </button>
              </div>

              {expMode === 'receipt' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-acc"
                    disabled={ocrReading}
                    onClick={() => handleSnapReceipt('marriott_folio_sacramento.jpg', 'Marriott Courtyard lodging')}
                  >
                    {ocrReading ? 'Reading Receipt...' : '📷 Snap Sample Marriott Receipt (AI OCR)'}
                  </button>
                  <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                    Upload Receipt Photo
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleSnapReceipt(f.name, f.name);
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {ocrModelBadge && (
                <div className="chip ok mono" style={{ alignSelf: 'flex-start' }}>
                  ✓ Receipt parsed by {ocrModelBadge}
                </div>
              )}

              {expMode === 'receipt' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div className="field">
                    <label>Merchant (AI Extracted)</label>
                    <input
                      type="text"
                      required
                      value={merchant}
                      onChange={e => setMerchant(e.target.value)}
                      placeholder="e.g. Courtyard by Marriott West Sacramento"
                    />
                  </div>
                  <div className="field">
                    <label>Date</label>
                    <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="mono"
                    />
                  </div>
                  <div className="field">
                    <label>Category</label>
                    <select value={category} onChange={e => setCategory(e.target.value as any)}>
                      <option value="lodging">Lodging</option>
                      <option value="meals">Meals</option>
                      <option value="airfare">Airfare / Transit</option>
                      <option value="supplies">IH Lab / Supplies</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <label>Round-Trip Miles</label>
                    <input type="number" step="0.1" value={miles} onChange={e => setMiles(e.target.value)} className="mono" />
                  </div>
                  <div className="field">
                    <label>Calculated Amount (@ $0.67/mi)</label>
                    <input
                      type="text"
                      readOnly
                      value={`$${(Number(miles || 0) * 0.67).toFixed(2)}`}
                      className="mono"
                    />
                  </div>
                  <div className="field">
                    <label>Date</label>
                    <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Program / Engagement</label>
                  <select value={expProgramId} onChange={e => setExpProgramId(e.target.value)}>
                    <option value="">— No Program —</option>
                    {engagements.map(eng => (
                      <option key={eng.id} value={eng.id}>
                        {eng.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Linked Job</label>
                  <select value={expJobId} onChange={e => setExpJobId(e.target.value)}>
                    {jobs.map(j => (
                      <option key={j.id} value={j.id}>
                        {j.id} · {j.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={billable} onChange={e => setBillable(e.target.checked)} />
                <span>Billable to customer / captive program draw-down</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-acc" disabled={savingExp}>
                  {savingExp ? 'Submitting Expense...' : 'Submit Expense'}
                </button>
              </div>
            </div>
          </form>

          <div className="card">
            <div className="card-head">
              <span className="card-title">Recent Expenses</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Merchant / Description</th>
                    <th>Category</th>
                    <th>Program &amp; Job</th>
                    <th>Billable</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(ex => (
                    <tr key={ex.id}>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WEEKLY TIMESHEET + POLICYHOLDER & EMPLOYEE SIGNATURES (Matches 05:48 - 06:00 in Video) */}
      {tab === 'timesheets' && (
        <form onSubmit={handleSignAndSendTimesheet} className="card">
          <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="kicker">End-of-Week Field Time &amp; Sign-Off</div>
              <span className="card-title">Weekly Timesheet · {userName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="kicker">Week Starting</span>
              <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Policyholder &amp; Job</th>
                    <th>Mon</th>
                    <th>Tue</th>
                    <th>Wed</th>
                    <th>Thu</th>
                    <th>Fri</th>
                    <th>Sat</th>
                    <th>Sun</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {tsRows.map((row, idx) => {
                    const rowSum =
                      Number(row.mon_hrs) +
                      Number(row.tue_hrs) +
                      Number(row.wed_hrs) +
                      Number(row.thu_hrs) +
                      Number(row.fri_hrs) +
                      Number(row.sat_hrs) +
                      Number(row.sun_hrs);
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, fontSize: 12.5 }}>{row.label}</td>
                        {(['mon_hrs', 'tue_hrs', 'wed_hrs', 'thu_hrs', 'fri_hrs', 'sat_hrs', 'sun_hrs'] as const).map(
                          dayKey => (
                            <td key={dayKey}>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="24"
                                value={row[dayKey]}
                                onChange={e =>
                                  setTsRows(prev =>
                                    prev.map((r, i) => (i === idx ? { ...r, [dayKey]: Number(e.target.value) } : r))
                                  )
                                }
                                className="mono"
                                style={{ width: 58, padding: '4px 6px' }}
                              />
                            </td>
                          )
                        )}
                        <td className="mono" style={{ fontWeight: 700 }}>
                          {rowSum.toFixed(1)}h
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {/* Optional Policyholder Sign-Off */}
              <div style={{ padding: 14, background: 'var(--bg-soft)', border: '1px solid var(--line)', borderRadius: 4 }}>
                <div className="kicker" style={{ marginBottom: 6 }}>
                  1. Get Policyholder Signatures (Optional Site Verification)
                </div>
                <div className="field">
                  <label>Policyholder Representative Name &amp; Title</label>
                  <input
                    type="text"
                    value={policyholderSignedBy}
                    onChange={e => setPolicyholderSignedBy(e.target.value)}
                    placeholder="e.g. Jorge Medina (Cal Plains Roofing)"
                  />
                </div>
              </div>

              {/* Employee Signature Pad (Draw or Upload) */}
              <div style={{ padding: 14, background: 'var(--bg-soft)', border: '1px solid var(--line)', borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="kicker">2. Employee Signature ({userName})</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className={'btn btn-sm ' + (sigMode === 'draw' ? 'btn-primary' : '')}
                      onClick={() => setSigMode('draw')}
                    >
                      Draw signature
                    </button>
                    <button
                      type="button"
                      className={'btn btn-sm ' + (sigMode === 'upload' ? 'btn-primary' : '')}
                      onClick={() => setSigMode('upload')}
                    >
                      Upload image
                    </button>
                    {sigMode === 'draw' && (
                      <button type="button" className="btn btn-sm" onClick={clearCanvas}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {sigMode === 'draw' ? (
                  <canvas
                    ref={canvasRef}
                    width={360}
                    height={90}
                    onMouseDown={startDraw}
                    onMouseMove={moveDraw}
                    onMouseUp={() => setDrawing(false)}
                    onMouseLeave={() => setDrawing(false)}
                    style={{
                      width: '100%',
                      height: 90,
                      background: '#fff',
                      border: '1px dashed var(--ink)',
                      cursor: 'crosshair',
                    }}
                  />
                ) : (
                  <input type="file" accept="image/*" onChange={() => setSigDrawn(true)} />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-acc" disabled={submittingTs}>
                {submittingTs ? 'Signing & Sending...' : 'Sign and send →'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

