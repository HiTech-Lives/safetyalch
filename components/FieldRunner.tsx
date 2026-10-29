'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from './ui';
import { PRIORITY_DAYS, fmtShort } from '@/lib/format';

export default function FieldRunner({
  insp,
  sections,
  questions,
  initialAnswers,
  initialRecs,
  priorSiteRecs,
}: {
  insp: any;
  sections: any[];
  questions: any[];
  initialAnswers: Record<string, any>;
  initialRecs: Record<string, any>;
  priorSiteRecs: any[];
}) {
  const router = useRouter();
  const [secNo, setSecNo] = useState<number>(sections[0]?.section_no ?? 1);
  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers);
  const [recs, setRecs] = useState<Record<string, any>>(initialRecs);
  const [editingUnsafeQ, setEditingUnsafeQ] = useState<any | null>(null);
  const [recText, setRecText] = useState('');
  const [recPriority, setRecPriority] = useState<'High' | 'Med' | 'Low'>('Med');
  const [measuredVal, setMeasuredVal] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const locked = !!insp.submitted_at;
  const maturity = insp.scale === 'maturity';
  const secQuestions = questions.filter(q => q.section_no === secNo);
  const answeredCount = Object.keys(answers).length;

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  async function recordAnswer(q: any, value: string, extra: Record<string, any> = {}) {
    if (locked) return;
    setAnswers(prev => ({ ...prev, [q.question_id]: { value, ...extra } }));
    const res = await fetch('/api/field', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'answer',
        inspectionId: insp.id,
        questionId: q.question_id,
        value,
        ...extra,
      }),
    });
    if (res.ok) {
      if (value === 'unsafe') {
        setRecs(prev => ({
          ...prev,
          [q.question_id]: {
            text: extra.recText || q.recommendation,
            priority: extra.priority || q.priority,
          },
        }));
      } else {
        setRecs(prev => {
          const next = { ...prev };
          delete next[q.question_id];
          return next;
        });
      }
      router.refresh();
    }
  }

  function handleUnsafeClick(q: any) {
    if (locked) return;
    const existing = recs[q.question_id];
    setEditingUnsafeQ(q);
    setRecText(existing?.text || q.recommendation || '');
    setRecPriority(existing?.priority || q.priority || 'Med');
    setMeasuredVal(answers[q.question_id]?.measured_value ?? '');
  }

  async function saveUnsafeFinding(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUnsafeQ) return;
    setBusy(true);
    await recordAnswer(editingUnsafeQ, 'unsafe', {
      recText,
      priority: recPriority,
      measuredValue: measuredVal !== '' ? Number(measuredVal) : null,
    });
    setBusy(false);
    setEditingUnsafeQ(null);
    notify(`Finding saved for Q ${editingUnsafeQ.question_id}.`);
  }

  function handleMeasurement(q: any, raw: string) {
    if (locked || raw === '') return;
    const num = Number(raw);
    if (Number.isNaN(num) || q.threshold === null) return;
    const thr = Number(q.threshold);
    const isSafe = q.comparison === 'min' ? num >= thr : num <= thr;
    if (isSafe) {
      recordAnswer(q, 'safe', { measuredValue: num });
      notify(`${num} ${q.measure_unit || ''} meets ${q.comparison === 'min' ? '≥' : '≤'} ${thr} → Marked Safe`);
    } else {
      setEditingUnsafeQ(q);
      setMeasuredVal(raw);
      setRecText(q.recommendation || `Measured ${num} ${q.measure_unit || ''} (required ${q.comparison === 'min' ? '≥' : '≤'} ${thr} ${q.measure_unit || ''}).`);
      setRecPriority(q.priority || 'High');
    }
  }

  async function submitInspection() {
    if (locked) return;
    setBusy(true);
    const res = await fetch('/api/field', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'submit', inspectionId: insp.id }),
    });
    const body = await res.json();
    setBusy(false);
    if (res.ok) {
      notify(body.message);
      router.push(`/inspections/${insp.id}`);
      router.refresh();
    } else {
      notify(body.error || 'Could not submit inspection');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Arrival Prep Banner */}
      {priorSiteRecs.length > 0 && (
        <div className="frame warn" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kicker" style={{ color: 'var(--warn7)' }}>Arrival Prep · {priorSiteRecs.length} Prior Open / Assumed Findings at {insp.site}</span>
            <Pill kind="unassigned">Verify on Floor</Pill>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
            {priorSiteRecs.slice(0, 3).map(p => (
              <div key={p.id}>
                <strong>{p.id} ({p.status === 'assumed' ? 'Risk Assumed' : 'Open · due ' + fmtShort(p.due_on)}):</strong> {p.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress & Submit Bar */}
      <Frame className="strong" style={{ padding: '14px 18px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div className="kicker">Field Progress · {answeredCount} of {questions.length} Items Answered</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>
            {Object.keys(recs).length} Unsafe Findings Raised · Device Lock Active ({insp.consultant})
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href={`/inspections/${insp.id}`} className="btn btn-sm">View in Console</Link>
          {!locked ? (
            <button className="btn btn-primary" disabled={busy} onClick={submitInspection}>
              {busy ? 'Submitting & Locking…' : 'Submit & Lock Inspection (7-Yr Immutable) →'}
            </button>
          ) : (
            <Pill kind="verified">Submitted &amp; Locked</Pill>
          )}
        </div>
      </Frame>

      <div className="split">
        {/* Section Navigator */}
        <div className="frame" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <div className="kicker" style={{ padding: '11px 16px', borderBottom: '1px solid var(--div)' }}>Sections</div>
          {sections.map(s => {
            const on = s.section_no === secNo;
            const secQs = questions.filter(q => q.section_no === s.section_no);
            const doneCount = secQs.filter(q => answers[q.question_id]?.value).length;
            return (
              <button
                key={s.section_no}
                type="button"
                onClick={() => setSecNo(s.section_no)}
                className="row"
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  fontSize: 13,
                  borderLeft: '4px solid ' + (on ? 'var(--acc)' : 'transparent'),
                  background: on ? 'var(--a1)' : '#fff',
                }}
              >
                <span className="kicker" style={{ width: 20 }}>{s.section_no}</span>
                <span style={{ flex: 1, lineHeight: 1.3 }}>{s.name}</span>
                <span className="kicker" style={{ color: doneCount === secQs.length ? 'var(--ok)' : undefined }}>
                  {doneCount}/{secQs.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Question Walkthrough */}
        <div className="frame strong" style={{ minWidth: 0 }}>
          <div className="panel-head">
            <h2>{secNo} · {sections.find(s => s.section_no === secNo)?.name}</h2>
            <span className="kicker">{maturity ? 'Tap maturity level (Absent → Owned)' : 'Tap Safe · Unsafe · N/A'}</span>
          </div>

          {secQuestions.map(q => {
            const cur = answers[q.question_id]?.value;
            const rec = recs[q.question_id];
            return (
              <div
                key={q.question_id}
                style={{
                  padding: '15px 18px',
                  borderTop: '1px solid var(--div2)',
                  background: cur === 'unsafe' ? 'var(--bad1)' : '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span className="code" style={{ minWidth: 36, paddingTop: 2 }}>{q.question_id}</span>
                  <div style={{ flex: 1, fontSize: 14, lineHeight: 1.45, fontWeight: 500 }}>{q.question_text}</div>
                </div>

                {/* Optional Numeric Measurement Input */}
                {q.threshold !== null && !maturity && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 46 }}>
                    <span className="kicker">
                      Threshold: {q.comparison === 'min' ? '≥' : '≤'} {Number(q.threshold)} {q.measure_unit || ''}
                    </span>
                    <input
                      className="input"
                      type="number"
                      step="any"
                      disabled={locked}
                      defaultValue={answers[q.question_id]?.measured_value ?? ''}
                      onBlur={e => handleMeasurement(q, e.target.value)}
                      placeholder={`Measure (${q.measure_unit || 'value'})`}
                      style={{ width: 150, height: 32 }}
                    />
                  </div>
                )}

                {/* Answer Controls */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingLeft: 46, alignItems: 'center' }}>
                  {maturity ? (
                    (['absent', 'written', 'practiced', 'owned', 'na'] as const).map(lv => (
                      <button
                        key={lv}
                        type="button"
                        disabled={locked}
                        onClick={() => recordAnswer(q, lv)}
                        className="btn btn-sm"
                        style={{
                          background: cur === lv ? 'var(--acc)' : '#fff',
                          color: cur === lv ? '#fff' : 'var(--ink)',
                          borderColor: cur === lv ? 'var(--acc)' : 'var(--div)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {lv}
                      </button>
                    ))
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => recordAnswer(q, 'safe')}
                        className="btn btn-sm"
                        style={{
                          background: cur === 'safe' ? 'var(--ok)' : '#fff',
                          color: cur === 'safe' ? '#fff' : 'var(--ink)',
                          borderColor: cur === 'safe' ? 'var(--ok)' : 'var(--div)',
                        }}
                      >
                        Safe
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => handleUnsafeClick(q)}
                        className="btn btn-sm"
                        style={{
                          background: cur === 'unsafe' ? 'var(--bad)' : '#fff',
                          color: cur === 'unsafe' ? '#fff' : 'var(--ink)',
                          borderColor: cur === 'unsafe' ? 'var(--bad)' : 'var(--div)',
                        }}
                      >
                        Unsafe · Finding
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => recordAnswer(q, 'na', { naReason: q.na_label || 'Not applicable on site' })}
                        className="btn btn-sm"
                        style={{
                          background: cur === 'na' ? 'var(--n7)' : '#fff',
                          color: cur === 'na' ? '#fff' : 'var(--ink)',
                          borderColor: cur === 'na' ? 'var(--n7)' : 'var(--div)',
                        }}
                      >
                        N/A{q.na_label ? `: ${q.na_label}` : ''}
                      </button>
                    </>
                  )}
                  <Pill kind="line">{q.topic}</Pill>
                  {!!q.is_shared && <Pill kind="shared">{q.question_key}</Pill>}
                </div>

                {cur === 'unsafe' && rec && (
                  <div style={{ marginLeft: 46, padding: '10px 12px', background: '#fff', border: '1px solid var(--bad)', fontSize: 12.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div>
                      <span className="kicker" style={{ color: 'var(--bad)' }}>
                        Finding ({rec.priority} · {PRIORITY_DAYS[rec.priority as keyof typeof PRIORITY_DAYS]}d):
                      </span>{' '}
                      {rec.text}
                    </div>
                    {!locked && (
                      <button type="button" className="btn btn-sm" onClick={() => handleUnsafeClick(q)}>Edit</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Finding Sheet Drawer */}
      {editingUnsafeQ && (
        <>
          <div className="drawer-bg" onClick={() => setEditingUnsafeQ(null)} />
          <aside className="drawer" role="dialog" aria-label="Record Unsafe Finding">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Q {editingUnsafeQ.question_id} · {editingUnsafeQ.topic} · {insp.jurisdiction}</div>
                <h2>Record Unsafe Finding &amp; Recommendation</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setEditingUnsafeQ(null)} aria-label="Close">×</button>
            </div>
            <form onSubmit={saveUnsafeFinding} className="drawer-body">
              <div style={{ fontSize: 13, color: 'var(--n7)', background: '#fff', padding: 12, border: '1px solid var(--div)' }}>
                {editingUnsafeQ.question_text}
              </div>
              <label className="field">
                <span>Corrective Recommendation Wording (Prints on Report)</span>
                <textarea className="input" rows={4} value={recText} onChange={e => setRecText(e.target.value)} required style={{ width: '100%' }} />
              </label>
              <label className="field">
                <span>Priority &amp; Abatement SLA</span>
                <select className="select" value={recPriority} onChange={e => setRecPriority(e.target.value as 'High' | 'Med' | 'Low')}>
                  <option value="High">High — 7 days (Imminent / Serious hazard)</option>
                  <option value="Med">Med — 30 days (Standard compliance item)</option>
                  <option value="Low">Low — 60 days (Programmatic / Best practice)</option>
                </select>
              </label>
              <div className="banner dashed" style={{ fontSize: 12 }}>
                Citation auto-resolves for topic <strong>{editingUnsafeQ.topic}</strong> in jurisdiction <strong>{insp.jurisdiction}</strong> (with Federal OSHA fallback). Repeat findings on key <strong>{editingUnsafeQ.question_key}</strong> are flagged automatically.
              </div>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>Save Unsafe Finding</button>
                <button type="button" className="btn" onClick={() => setEditingUnsafeQ(null)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

