'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type TemplateType = 'post_incident' | 'equipment_breakdown' | 'followup_survey' | 'commercial_supplement';

export default function QuickReportClient({
  members,
  jobs,
  observations,
  existingReports,
  userName,
  initialMemberId,
  initialSiteId,
  initialJobId,
}: {
  members: any[];
  jobs: any[];
  observations: any[];
  existingReports: any[];
  userName: string;
  initialMemberId?: string;
  initialSiteId?: string;
  initialJobId?: string;
}) {
  const router = useRouter();
  const defaultMember = members.find(m => m.id === initialMemberId) || members.find(m => m.id === 'm8') || members[0];
  const [memberId, setMemberId] = useState<string>(defaultMember?.id || '');
  const selectedMember = members.find(m => m.id === memberId) || defaultMember;
  const [siteId, setSiteId] = useState<string>(initialSiteId || selectedMember?.sites?.[0]?.id || '');
  const [jobId, setJobId] = useState<string>(initialJobId || jobs.find(j => j.member_id === memberId)?.id || '');
  const selectedJob = jobs.find(j => j.id === jobId);

  const [templateType, setTemplateType] = useState<TemplateType>('post_incident');
  const [title, setTitle] = useState<string>(
    selectedJob?.title || `Post-incident review: ${selectedMember?.name || 'Cal Plains Roofing'}`
  );
  const [incidentDate, setIncidentDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Previous photos for the Member captured earlier today (Matches 03:38 in Video)
  const memberObs = observations.filter(o => o.member_id === memberId);
  const [photos, setPhotos] = useState<
    { id: string; label: string; kind: 'hazard' | 'positive' | 'documentation'; location: string; caption: string; included: boolean }[]
  >(
    (memberObs.length > 0
      ? memberObs.map((o, idx) => ({
          id: o.id,
          label: `Photo ${idx + 1} · ${o.title}`,
          kind: (o.photo_kind || 'hazard') as 'hazard' | 'positive' | 'documentation',
          location: o.specific_location || o.site_name || 'Main Site',
          caption: `${o.description} (${o.federal_citation} / ${o.state_citation})`,
          included: true,
        }))
      : [
          {
            id: 'p1',
            label: 'Photo 1 · West Loading Dock Extension Ladder',
            kind: 'hazard',
            location: 'West Loading Dock Roof Access',
            caption: '24-ft fiberglass extension ladder side rails extended only 18" above parapet cap (29 CFR 1926.1053(b)(1) / Cal/OSHA 8 CCR §1675(i)).',
            included: true,
          },
          {
            id: 'p2',
            label: 'Photo 2 · North Perimeter Warning Line',
            kind: 'hazard',
            location: 'North Roof Perimeter / Bay 4',
            caption: 'Two warning line stanchions tipped over; flagging sagged below 30 inches (29 CFR 1926.502(f)(2) / Cal/OSHA 8 CCR §1724(g)).',
            included: true,
          },
          {
            id: 'p3',
            label: 'Photo 3 · Center Roof Hatch Guardrail System',
            kind: 'positive',
            location: 'Center Roof Hatch',
            caption: 'Compliant yellow tubular guardrail and self-closing gate around main roof access hatch.',
            included: true,
          },
        ])
  );

  const [voiceTranscript, setVoiceTranscript] = useState(
    memberObs[0]?.voice_transcript ||
      'Completed post-incident review at Cal Plains Roofing with Superintendent Jorge Medina. A sheet-metal subcontractor worker experienced a near-miss slip at the west loading dock parapet because the 24-foot extension ladder only extended 18 inches above the landing and was untied. Superintendent corrected the tie-off during our walk.'
  );
  const [fieldNotes, setFieldNotes] = useState(
    selectedJob?.notes || 'Carrier Ref GSC-WC-26-0412 · Golden State Contractors Captive member risk control program.'
  );

  const [generating, setGenerating] = useState(false);
  const [aiModelUsed, setAiModelUsed] = useState('');
  const [sections, setSections] = useState<{
    what_happened: string;
    sequence_of_events: string;
    contributing_factors: string;
    root_cause: string;
    overall_exposure: string;
    findings_and_recommendations: string;
    program_manager_summary: string;
  } | null>(null);

  const [consultantVerified, setConsultantVerified] = useState(false);
  const [deliverImmediately, setDeliverImmediately] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [playingTTS, setPlayingTTS] = useState(false);
  const [ttsModelBadge, setTtsModelBadge] = useState('elevenlabs:eleven_flash_v2_5');

  async function handleListenReadback() {
    if (!sections) return;
    if (playingTTS) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPlayingTTS(false);
      return;
    }
    setPlayingTTS(true);
    const readbackText = `${title}. Executive Summary: ${sections.what_happened} Root Cause: ${sections.root_cause} Program Manager Summary: ${sections.program_manager_summary}`;
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'tts_briefing',
        text: readbackText,
      }),
    });
    const data = await res.json();
    if (data.model_used) setTtsModelBadge(data.model_used);
    if (data.audioDataUrl && typeof window !== 'undefined') {
      const audio = new Audio(data.audioDataUrl);
      audio.onended = () => setPlayingTTS(false);
      audio.play().catch(() => setPlayingTTS(false));
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(readbackText);
      utter.rate = 1.03;
      utter.onend = () => setPlayingTTS(false);
      window.speechSynthesis.speak(utter);
    } else {
      setPlayingTTS(false);
    }
  }

  async function handleGenerateReport() {
    setGenerating(true);
    const siteObj = selectedMember?.sites?.find((s: any) => s.id === siteId) || selectedMember?.sites?.[0];
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'generate_quick_report',
        templateType,
        memberName: selectedMember?.name || 'Cal Plains Roofing',
        siteName: siteObj?.name || 'Primary Site',
        carrierRef: selectedJob?.carrier_ref || 'GSC-WC-26-0412',
        programTitle: selectedJob?.program_title || 'Golden State Contractors Captive, member risk control program',
        photos: photos.filter(p => p.included),
        voiceTranscript,
        fieldNotes,
      }),
    });
    const data = await res.json();
    setGenerating(false);
    if (data.ok && data.sections) {
      setSections(data.sections);
      setAiModelUsed(data.model_used || 'aws_bedrock:qwen.qwen2.5-32b-instruct-v1:0');
      setConsultantVerified(false);
    }
  }

  async function handleSubmitReport() {
    if (!sections || !consultantVerified) return;
    setSubmitting(true);
    const res = await fetch('/api/quick-reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'submit_report',
        job_id: jobId || null,
        member_id: memberId,
        site_id: siteId || null,
        template_type: templateType,
        title,
        incident_date: incidentDate,
        sections,
        photos: photos.filter(p => p.included),
        voice_transcript: voiceTranscript,
        field_notes: fieldNotes,
        ai_model_used: aiModelUsed,
        consultant_verified: consultantVerified,
        verified_by_name: userName,
        deliver_immediately: deliverImmediately,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.ok && data.id) {
      router.push(`/quick-reports/${data.id}/report`);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Template & Job Selector (Matches 03:23 - 03:45 in Video) */}
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="kicker">Step 2 · &ldquo;In the Truck&rdquo; Narrative Report Builder</div>
            <span className="card-title">AI Quick Report Generator</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(
              [
                ['post_incident', 'Post-Incident Review'],
                ['equipment_breakdown', 'Equipment Breakdown'],
                ['followup_survey', 'Follow-Up Survey'],
                ['commercial_supplement', 'Commercial Supplement'],
              ] as [TemplateType, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={'btn btn-sm ' + (templateType === k ? 'btn-acc' : '')}
                onClick={() => setTemplateType(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div className="field">
              <label>Policyholder / Member</label>
              <select value={memberId} onChange={e => setMemberId(e.target.value)}>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.city})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Linked Work Queue Job</label>
              <select value={jobId} onChange={e => setJobId(e.target.value)}>
                <option value="">— Standalone Report —</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.id} · {j.title} ({j.carrier_ref || 'Direct'})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Report Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>Incident / Survey Date</label>
              <input type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} />
            </div>
          </div>

          {/* Previous Photos for the Member (Pulled automatically from Quick Capture) */}
          <div>
            <div className="kicker" style={{ marginBottom: 8 }}>
              Previous Photos for {selectedMember?.name} (Captured Today — Tag as Hazard, Positive, or Documentation)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {photos.map((p, idx) => (
                <div
                  key={p.id}
                  style={{
                    padding: 12,
                    background: 'var(--bg-soft)',
                    border: '1px solid var(--line)',
                    borderRadius: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={p.included}
                      onChange={e =>
                        setPhotos(prev => prev.map((x, i) => (i === idx ? { ...x, included: e.target.checked } : x)))
                      }
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {p.label} <span className="muted">({p.location})</span>
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>{p.caption}</div>
                    </div>
                  </label>

                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['hazard', 'positive', 'documentation'] as const).map(k => (
                      <button
                        key={k}
                        type="button"
                        className={'btn btn-sm ' + (p.kind === k ? (k === 'hazard' ? 'btn-acc' : 'btn-primary') : '')}
                        onClick={() =>
                          setPhotos(prev => prev.map((x, i) => (i === idx ? { ...x, kind: k } : x)))
                        }
                      >
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Voice Memo Transcript</label>
              <textarea rows={3} value={voiceTranscript} onChange={e => setVoiceTranscript(e.target.value)} />
            </div>
            <div className="field">
              <label>Additional Field Notes &amp; Carrier Instructions</label>
              <textarea rows={3} value={fieldNotes} onChange={e => setFieldNotes(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-acc" disabled={generating} onClick={handleGenerateReport}>
              {generating ? 'Drafting Narrative Report with AI...' : 'Generate Report (Draft All Sections) →'}
            </button>
          </div>
        </div>
      </div>

      {/* AI-Drafted Report Sections + Required Consultant Verification (Matches 04:05 - 04:42 in Video) */}
      {sections && (
        <div className="card" style={{ border: '2px solid var(--ink)' }}>
          <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="kicker">
                AI-Drafted Loss Control Deliverable · Model: {aiModelUsed} · Voice: {ttsModelBadge}
              </div>
              <span className="card-title">{title}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={'btn btn-sm ' + (playingTTS ? 'btn-acc' : '')}
                onClick={handleListenReadback}
              >
                {playingTTS ? '⏹ Stop Readback' : '🔊 Listen in the Truck (ElevenLabs TTS)'}
              </button>
              <span className={'chip ' + (consultantVerified ? 'ok' : 'warn')}>
                {consultantVerified ? 'Consultant Verified ✓' : 'AI Draft — Requires Consultant Sign-Off'}
              </span>
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(
              [
                ['what_happened', '1. What Happened / Executive Summary'],
                ['sequence_of_events', '2. Sequence of Events'],
                ['contributing_factors', '3. Contributing Factors & Standards'],
                ['root_cause', '4. Root Cause Analysis'],
                ['overall_exposure', '5. Overall Exposure Assessment'],
                ['findings_and_recommendations', '6. Findings & Corrective Action Recommendations'],
                ['program_manager_summary', '7. Summary for the Program Manager / Underwriter'],
              ] as [keyof typeof sections, string][]
            ).map(([key, label]) => (
              <div key={key} className="field">
                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{label}</span>
                  {!consultantVerified && <span className="chip warn" style={{ fontSize: 10 }}>AI</span>}
                </label>
                <textarea
                  rows={key === 'sequence_of_events' || key === 'findings_and_recommendations' ? 4 : 3}
                  value={sections[key]}
                  onChange={e => setSections(prev => (prev ? { ...prev, [key]: e.target.value } : prev))}
                />
              </div>
            ))}

            {/* Mandatory Consultant Verification Checkbox (Matches 04:32 in Video) */}
            <div
              style={{
                padding: 16,
                background: consultantVerified ? 'rgba(31,94,59,.08)' : 'var(--bg-soft)',
                border: '2px solid ' + (consultantVerified ? 'var(--ok)' : 'var(--warn)'),
                borderRadius: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consultantVerified}
                  onChange={e => setConsultantVerified(e.target.checked)}
                />
                <span>
                  I have reviewed this AI-generated report and confirm it is accurate ({userName})
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deliverImmediately}
                  onChange={e => setDeliverImmediately(e.target.checked)}
                />
                <span>
                  Mark linked Work Queue job as <strong>Delivered</strong> immediately (unlocks 1-click{' '}
                  <strong>Bill</strong> on the Work Queue)
                </span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-acc"
                  disabled={!consultantVerified || submitting}
                  onClick={handleSubmitReport}
                >
                  {submitting ? 'Submitting & Locking Report...' : 'Submit Report & Open Printable PDF →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Quick Reports */}
      {existingReports.length > 0 && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Submitted Quick Reports ({existingReports.length})</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Report Title</th>
                  <th>Policyholder</th>
                  <th>Template</th>
                  <th>Verified By</th>
                  <th>AI Model</th>
                  <th>Status</th>
                  <th>Printable PDF</th>
                </tr>
              </thead>
              <tbody>
                {existingReports.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.title}</td>
                    <td>{r.member_name}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{r.template_type}</td>
                    <td>{r.verified_by_name || r.author_name}</td>
                    <td className="mono muted" style={{ fontSize: 11 }}>{r.ai_model_used}</td>
                    <td>
                      <span className={'chip ' + (r.status === 'delivered' ? 'ok' : 'warn')}>{r.status}</span>
                    </td>
                    <td>
                      <Link href={`/quick-reports/${r.id}/report`} className="btn btn-sm">
                        View / Print PDF →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

