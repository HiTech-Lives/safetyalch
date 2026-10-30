'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  received: { label: 'Received', tone: 'warn' },
  scheduled: { label: 'Scheduled', tone: '' },
  visit_done: { label: 'Visit done, writing', tone: 'warn' },
  client_submitted: { label: 'Client submitted', tone: 'warn' },
  in_qc: { label: 'In QC', tone: 'warn' },
  delivered: { label: 'Delivered', tone: 'ok' },
};

const NEXT_STATUS: Record<string, { next: string; btn: string }> = {
  received: { next: 'scheduled', btn: 'Mark Scheduled' },
  scheduled: { next: 'visit_done', btn: 'Mark Visit Done' },
  visit_done: { next: 'in_qc', btn: 'Send to QC' },
  client_submitted: { next: 'in_qc', btn: 'Move to QC' },
  in_qc: { next: 'delivered', btn: 'Approve & Deliver' },
};

const SAMPLE_CAPTIVE_EMAIL = `From: Megan Holt <mholt@westlinerisk.com>
Subject: Loss Control Request - GSC-WC-26-0412 - Cal Plains Roofing (Post-incident review)

Team,
Please schedule a Post-incident review for our captive member Cal Plains Roofing under the Golden State Contractors Captive, member risk control program.

Carrier Reference: GSC-WC-26-0412
Service: Post-incident review
Insured: Cal Plains Roofing
Requested By: Megan Holt, Westline Risk Partners
Site Address: 1420 Industrial Pkwy, West Sacramento, CA 95691
Site Contact: Jorge Medina
Phone: (916) 555-0148
Email: jmedina@calplainsroofing.com
Approved Fee: $1,850.00
Target Due Date: ${new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)}

Special Instructions:
Sub-crew experienced a near-miss ladder slip near the west loading dock parapet yesterday afternoon. Please inspect portable extension ladder tie-offs, 36-inch extension above the roof landing, and perimeter warning lines (29 CFR 1926.1053 / Cal/OSHA 8 CCR 1675).`;

export default function WorkQueueManager({
  jobs,
  engagements,
  sources,
  members,
  staff,
}: {
  jobs: any[];
  engagements: any[];
  sources: any[];
  members: any[];
  staff: any[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'queue' | 'billing'>('queue');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [sourceIdFilter, setSourceIdFilter] = useState<string>('all');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [unbilledOnly, setUnbilledOnly] = useState<boolean>(false);

  // "New from email" modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<'paste' | 'form'>('paste');
  const [rawEmail, setRawEmail] = useState('');
  const [readingEmail, setReadingEmail] = useState(false);
  const [aiModelBadge, setAiModelBadge] = useState('');

  // Extracted / Editable Job Fields
  const [title, setTitle] = useState('');
  const [carrierRef, setCarrierRef] = useState('');
  const [serviceType, setServiceType] = useState('Post-incident review');
  const [insuredName, setInsuredName] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [siteContact, setSiteContact] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [engagementId, setEngagementId] = useState(engagements[0]?.id || '');
  const [memberId, setMemberId] = useState('');
  const [fee, setFee] = useState('1850');
  const [jobStatus, setJobStatus] = useState('scheduled');
  const [assignedTo, setAssignedTo] = useState(staff[0]?.id || '');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
  const [visitScheduledDate, setVisitScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [savingJob, setSavingJob] = useState(false);

  // Selected job detail drawer
  const [selectedJob, setSelectedJob] = useState<any | null>(null);

  // KPIs matching 00:02 of Safely Track video
  const receivedCount = jobs.filter(j => j.status === 'received').length;
  const scheduledCount = jobs.filter(j => j.status === 'scheduled').length;
  const visitDoneCount = jobs.filter(j => j.status === 'visit_done' || j.status === 'client_submitted').length;
  const inQcCount = jobs.filter(j => j.status === 'in_qc').length;
  const deliveredUnbilledCount = jobs.filter(j => j.status === 'delivered' && !j.billed).length;

  const filtered = jobs.filter(j => {
    if (tab === 'billing' && j.status !== 'delivered') return false;
    if (sourceTypeFilter !== 'all' && j.source_type !== sourceTypeFilter) return false;
    if (sourceIdFilter !== 'all' && j.source_id !== sourceIdFilter) return false;
    if (programFilter !== 'all' && j.engagement_id !== programFilter) return false;
    if (statusFilter === 'open' && j.status === 'delivered' && j.billed) return false;
    if (statusFilter !== 'open' && statusFilter !== 'all' && j.status !== statusFilter) return false;
    if (unbilledOnly && j.billed) return false;
    return true;
  });

  async function handleReadEmail() {
    if (!rawEmail.trim()) return;
    setReadingEmail(true);
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'parse_email', rawEmail }),
    });
    const data = await res.json();
    setReadingEmail(false);
    if (data.ok && data.parsed) {
      const p = data.parsed;
      setTitle(p.title || '');
      setCarrierRef(p.carrier_ref || '');
      setServiceType(p.service_type || 'Post-incident review');
      setInsuredName(p.insured_name || '');
      setRequestedBy(p.requested_by || '');
      setSiteAddress(p.site_address || '');
      setSiteContact(p.site_contact || '');
      setContactPhone(p.contact_phone || '');
      setContactEmail(p.contact_email || '');
      setFee(String(p.fee || 1850));
      setReceivedDate(p.received_date || new Date().toISOString().slice(0, 10));
      setDueDate(p.due_date || '');
      setVisitScheduledDate(p.visit_scheduled_date || new Date().toISOString().slice(0, 10));
      setNotes(p.notes || '');
      setAiModelBadge(p.model_used || 'aws_bedrock:qwen');

      // Match program & member automatically
      const matchedEng = engagements.find(e =>
        e.title.toLowerCase().includes((p.program_hint || '').toLowerCase().slice(0, 18))
      );
      if (matchedEng) setEngagementId(matchedEng.id);

      const matchedMem = members.find(m => m.name.toLowerCase() === (p.insured_name || '').toLowerCase());
      if (matchedMem) setMemberId(matchedMem.id);

      setEmailStep('form');
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawEmail(String(reader.result || SAMPLE_CAPTIVE_EMAIL));
    };
    reader.readAsText(file);
  }

  async function handleSaveJob(e: React.FormEvent) {
    e.preventDefault();
    setSavingJob(true);
    await fetch('/api/work-queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create_job',
        title,
        carrier_ref: carrierRef,
        service_type: serviceType,
        insured_name: insuredName,
        requested_by: requestedBy,
        site_address: siteAddress,
        site_contact: siteContact,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        engagement_id: engagementId || null,
        member_id: memberId || null,
        fee: Number(fee),
        status: jobStatus,
        assigned_to: assignedTo || null,
        received_date: receivedDate,
        due_date: dueDate,
        visit_scheduled_date: visitScheduledDate,
        notes,
        raw_email_text: rawEmail,
      }),
    });
    setSavingJob(false);
    setEmailModalOpen(false);
    router.refresh();
  }

  async function advanceStatus(id: string, status: string) {
    await fetch('/api/work-queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update_status', id, status }),
    });
    router.refresh();
  }

  async function billJob(id: string) {
    await fetch('/api/work-queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'bill_job', id }),
    });
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Pipeline KPIs matching 00:02 of Safely Track video */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => setStatusFilter('received')}>
          <div className="kicker">1 · Received</div>
          <div className="kpi-num">{receivedCount}</div>
          <div className="kpi-sub">Needs scheduling / dispatch</div>
        </div>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => setStatusFilter('scheduled')}>
          <div className="kicker">2 · Scheduled</div>
          <div className="kpi-num">{scheduledCount}</div>
          <div className="kpi-sub">On inspector route</div>
        </div>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => setStatusFilter('visit_done')}>
          <div className="kicker">3 · Visit Done</div>
          <div className="kpi-num">{visitDoneCount}</div>
          <div className="kpi-sub">Writing report in truck / office</div>
        </div>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => setStatusFilter('in_qc')}>
          <div className="kicker">4 · In QC</div>
          <div className="kpi-num" style={{ color: 'var(--warn)' }}>{inQcCount}</div>
          <div className="kpi-sub">Awaiting supervisor review</div>
        </div>
        <div
          className="kpi"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setStatusFilter('delivered');
            setUnbilledOnly(true);
          }}
        >
          <div className="kicker">5 · Delivered, Not Billed</div>
          <div className="kpi-num" style={{ color: 'var(--ok)' }}>{deliveredUnbilledCount}</div>
          <div className="kpi-sub">Ready for 1-click billing</div>
        </div>
      </div>

      {/* Filter Bar & New from Email CTA */}
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={'btn btn-sm ' + (tab === 'queue' ? 'btn-primary' : '')}
              onClick={() => setTab('queue')}
            >
              Queue ({jobs.length})
            </button>
            <button
              type="button"
              className={'btn btn-sm ' + (tab === 'billing' ? 'btn-primary' : '')}
              onClick={() => setTab('billing')}
            >
              Billing ({jobs.filter(j => j.status === 'delivered').length})
            </button>
            <span style={{ color: 'var(--line)' }}>|</span>
            {(['all', 'carrier', 'captive', 'commercial'] as const).map(st => (
              <button
                key={st}
                type="button"
                className={'btn btn-sm ' + (sourceTypeFilter === st ? 'btn-acc' : '')}
                onClick={() => setSourceTypeFilter(st)}
              >
                {st === 'all' ? 'All Sources' : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-acc"
              onClick={() => {
                setRawEmail(SAMPLE_CAPTIVE_EMAIL);
                setEmailStep('paste');
                setEmailModalOpen(true);
              }}
            >
              + New from email (AI Intake)
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setRawEmail('');
                setTitle('');
                setEmailStep('form');
                setEmailModalOpen(true);
              }}
            >
              + New job by hand
            </button>
          </div>
        </div>

        <div
          className="card-body"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            borderBottom: '1px solid var(--line)',
            padding: '10px 18px',
            background: 'var(--bg-soft)',
          }}
        >
          <select value={sourceIdFilter} onChange={e => setSourceIdFilter(e.target.value)} style={{ fontSize: 12.5 }}>
            <option value="all">Every source ({sources.length})</option>
            {sources.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.source_type})
              </option>
            ))}
          </select>

          <select value={programFilter} onChange={e => setProgramFilter(e.target.value)} style={{ fontSize: 12.5 }}>
            <option value="all">Every program ({engagements.length})</option>
            {engagements.map(e => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ fontSize: 12.5 }}>
            <option value="open">Open &amp; Unbilled</option>
            <option value="all">Every status</option>
            <option value="received">Received</option>
            <option value="scheduled">Scheduled</option>
            <option value="visit_done">Visit done, writing</option>
            <option value="in_qc">In QC</option>
            <option value="delivered">Delivered</option>
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={unbilledOnly} onChange={e => setUnbilledOnly(e.target.checked)} />
            <span>Unbilled only</span>
          </label>
        </div>

        {/* Work Queue Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Job / Carrier Ref</th>
                <th>Policyholder &amp; Site</th>
                <th>Source / Program</th>
                <th>Service</th>
                <th>Assigned To</th>
                <th>Visit / Due</th>
                <th>Fee</th>
                <th>Status</th>
                <th>Billed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(j => {
                const st = STATUS_LABELS[j.status] || { label: j.status, tone: '' };
                const next = NEXT_STATUS[j.status];
                return (
                  <tr key={j.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => setSelectedJob(j)}
                        style={{
                          background: 'none',
                          border: 0,
                          padding: 0,
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontWeight: 600,
                          color: 'var(--ink)',
                        }}
                      >
                        {j.title}
                      </button>
                      <div className="mono muted" style={{ fontSize: 11 }}>
                        {j.id} · {j.carrier_ref || 'NO-REF'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{j.insured_name}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>
                        {j.site_address || j.site_name || 'Primary location'}
                      </div>
                      {j.site_contact && (
                        <div className="muted" style={{ fontSize: 11 }}>
                          Contact: {j.site_contact} {j.contact_phone ? `· ${j.contact_phone}` : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{j.source_name || 'Direct Commercial'}</div>
                      {j.referral_name && (
                        <div className="muted" style={{ fontSize: 11 }}>
                          via {j.referral_name}
                        </div>
                      )}
                      {j.program_title && (
                        <div className="muted" style={{ fontSize: 11, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {j.program_title}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12.5 }}>{j.service_type}</td>
                    <td>
                      {j.assigned_to_name ? (
                        <span style={{ fontWeight: 600, fontSize: 12.5 }}>{j.assigned_to_name}</span>
                      ) : (
                        <Link href="/assignments" className="chip warn">
                          Unassigned →
                        </Link>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      <div>Visit: {j.visit_scheduled_date || 'TBD'}</div>
                      <div className="muted">Due: {j.due_date || '—'}</div>
                    </td>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      ${Number(j.fee).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        <span className={'chip ' + st.tone}>{st.label}</span>
                        {next && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ fontSize: 10.5, padding: '2px 7px' }}
                            onClick={() => advanceStatus(j.id, next.next)}
                          >
                            {next.btn} →
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      {j.billed ? (
                        <span className="chip ok">Billed ✓</span>
                      ) : j.status === 'delivered' ? (
                        <button type="button" className="btn btn-sm btn-acc" onClick={() => billJob(j.id)}>
                          Bill
                        </button>
                      ) : (
                        <span className="muted mono" style={{ fontSize: 11 }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* "New from email" AI Intake Modal (Matches 00:18 - 01:05 in Video) */}
      {emailModalOpen && (
        <div className="scrim" onClick={() => setEmailModalOpen(false)}>
          <div
            className="drawer"
            style={{ width: emailStep === 'form' ? 'min(1080px, 96vw)' : 'min(680px, 95vw)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="drawer-head">
              <div>
                <div className="kicker">Loss Control Work Queue · AI Intake</div>
                <div style={{ font: '700 20px var(--fh)', textTransform: 'uppercase' }}>
                  {emailStep === 'paste' ? 'New Job from Email or Request File' : 'Verify Extracted Job & Dispatch'}
                </div>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setEmailModalOpen(false)}>
                Close ✕
              </button>
            </div>

            <div className="drawer-body">
              {emailStep === 'paste' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                    Paste a loss-control request email from a carrier, captive, or broker (or upload a <code>.eml</code>,{' '}
                    <code>.txt</code>, <code>.pdf</code>, or <code>.docx</code> request sheet). Our configured AI model (AWS
                    Bedrock Qwen / Azure AI / Local Engine) will extract the policyholder, carrier ref, fee, program, and site
                    contact automatically.
                  </p>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setRawEmail(SAMPLE_CAPTIVE_EMAIL)}
                    >
                      Load Sample Captive Request (Cal Plains Roofing)
                    </button>
                    <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                      Upload .eml / .txt / .pdf / .docx
                      <input
                        type="file"
                        accept=".eml,.txt,.pdf,.docx"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>

                  <div className="field">
                    <label>Request Email or Document Text</label>
                    <textarea
                      rows={13}
                      value={rawEmail}
                      onChange={e => setRawEmail(e.target.value)}
                      placeholder="Paste carrier or broker request email here..."
                      className="mono"
                      style={{ fontSize: 12 }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <button type="button" className="btn" onClick={() => setEmailStep('form')}>
                      Skip, fill by hand →
                    </button>
                    <button
                      type="button"
                      className="btn btn-acc"
                      disabled={readingEmail || !rawEmail.trim()}
                      onClick={handleReadEmail}
                    >
                      {readingEmail ? 'Reading email with AI...' : 'Read it (Extract Job Fields) →'}
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleSaveJob}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: rawEmail ? '1.35fr 0.9fr' : '1fr',
                    gap: 20,
                    alignItems: 'start',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {aiModelBadge && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-soft)', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--line)' }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          ✓ Pre-filled from email via <span className="mono">{aiModelBadge}</span>
                        </span>
                        <button type="button" className="btn btn-sm" onClick={() => setEmailStep('paste')}>
                          ← Re-read email
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 10 }}>
                      <div className="field">
                        <label>Title</label>
                        <input type="text" required value={title} onChange={e => setTitle(e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Carrier Reference</label>
                        <input type="text" value={carrierRef} onChange={e => setCarrierRef(e.target.value)} className="mono" />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="field">
                        <label>Service</label>
                        <input type="text" required value={serviceType} onChange={e => setServiceType(e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Insured / Policyholder</label>
                        <input type="text" required value={insuredName} onChange={e => setInsuredName(e.target.value)} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="field">
                        <label>Requested By (Broker / Underwriter)</label>
                        <input type="text" value={requestedBy} onChange={e => setRequestedBy(e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Site Address</label>
                        <input type="text" value={siteAddress} onChange={e => setSiteAddress(e.target.value)} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div className="field">
                        <label>Site Contact</label>
                        <input type="text" value={siteContact} onChange={e => setSiteContact(e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Contact Phone</label>
                        <input type="text" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Contact Email</label>
                        <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
                      <div className="field">
                        <label>Program / Engagement</label>
                        <select value={engagementId} onChange={e => setEngagementId(e.target.value)}>
                          <option value="">— Standalone / Direct Commercial —</option>
                          {engagements.map(eng => (
                            <option key={eng.id} value={eng.id}>
                              {eng.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Policyholder (Member Record)</label>
                        <select value={memberId} onChange={e => setMemberId(e.target.value)}>
                          <option value="">Auto-match or create &ldquo;{insuredName || 'New Member'}&rdquo;</option>
                          {members.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.city})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div className="field">
                        <label>Fee ($)</label>
                        <input type="number" step="0.01" value={fee} onChange={e => setFee(e.target.value)} className="mono" />
                      </div>
                      <div className="field">
                        <label>Status</label>
                        <select value={jobStatus} onChange={e => setJobStatus(e.target.value)}>
                          <option value="received">Received</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="visit_done">Visit done, writing</option>
                          <option value="in_qc">In QC</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Assigned To</label>
                        <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                          <option value="">— Unassigned —</option>
                          {staff.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div className="field">
                        <label>Received Date</label>
                        <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Due Date</label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Visit Scheduled Date</label>
                        <input type="date" value={visitScheduledDate} onChange={e => setVisitScheduledDate(e.target.value)} />
                      </div>
                    </div>

                    <div className="field">
                      <label>Notes &amp; Special Instructions</label>
                      <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button type="button" className="btn" onClick={() => setEmailModalOpen(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-acc" disabled={savingJob}>
                        {savingJob ? 'Creating Job & Route Stop...' : 'Create Job & Add to Work Queue'}
                      </button>
                    </div>
                  </div>

                  {rawEmail && (
                    <div
                      style={{
                        background: 'var(--bg-soft)',
                        border: '1px solid var(--line)',
                        borderRadius: 4,
                        padding: 14,
                        position: 'sticky',
                        top: 0,
                      }}
                    >
                      <div className="kicker" style={{ marginBottom: 6 }}>
                        Original Request Email (Preserved Side-by-Side)
                      </div>
                      <pre
                        className="mono"
                        style={{
                          margin: 0,
                          fontSize: 11.5,
                          whiteSpace: 'pre-wrap',
                          maxHeight: 520,
                          overflowY: 'auto',
                          color: 'var(--ink-2)',
                        }}
                      >
                        {rawEmail}
                      </pre>
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Job Detail Drawer */}
      {selectedJob && (
        <div className="scrim" onClick={() => setSelectedJob(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div className="kicker">
                  {selectedJob.id} · {selectedJob.carrier_ref || 'Direct Job'}
                </div>
                <div style={{ font: '700 20px var(--fh)', textTransform: 'uppercase' }}>{selectedJob.title}</div>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setSelectedJob(null)}>
                Close ✕
              </button>
            </div>
            <div className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div className="kicker">Insured / Policyholder</div>
                  <div style={{ fontWeight: 600 }}>{selectedJob.insured_name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{selectedJob.site_address}</div>
                </div>
                <div>
                  <div className="kicker">Site Contact</div>
                  <div style={{ fontWeight: 600 }}>{selectedJob.site_contact || '—'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {selectedJob.contact_phone} · {selectedJob.contact_email}
                  </div>
                </div>
                <div>
                  <div className="kicker">Program / Engagement</div>
                  <div style={{ fontWeight: 600 }}>{selectedJob.program_title || 'Direct Commercial'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>Requested by: {selectedJob.requested_by || '—'}</div>
                </div>
                <div>
                  <div className="kicker">Approved Fee &amp; Billing</div>
                  <div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>
                    ${Number(selectedJob.fee).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {selectedJob.billed ? `Billed on ${selectedJob.billed_at}` : 'Unbilled'}
                  </div>
                </div>
              </div>

              {selectedJob.notes && (
                <div>
                  <div className="kicker">Notes &amp; Special Instructions</div>
                  <p style={{ margin: '4px 0 0', fontSize: 13 }}>{selectedJob.notes}</p>
                </div>
              )}

              {selectedJob.raw_email_text && (
                <div>
                  <div className="kicker">Original Intake Email</div>
                  <pre
                    className="mono"
                    style={{
                      background: 'var(--bg-soft)',
                      padding: 12,
                      border: '1px solid var(--line)',
                      fontSize: 11.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedJob.raw_email_text}
                  </pre>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                <Link href={`/field/route`} className="btn btn-sm">
                  View on Inspector Route →
                </Link>
                <Link href={`/field/capture?job=${selectedJob.id}`} className="btn btn-sm">
                  Open AI Quick Capture →
                </Link>
                <Link href={`/field/quick-report?job=${selectedJob.id}`} className="btn btn-sm btn-acc">
                  Draft AI Quick Report →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

