'use client';
import { useState, useMemo } from 'react';
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
  standaloneRecs,
  priorSiteRecs,
  bookRecommendations,
}: {
  insp: any;
  sections: any[];
  questions: any[];
  initialAnswers: Record<string, any>;
  initialRecs: Record<string, any>;
  standaloneRecs: any[];
  priorSiteRecs: any[];
  bookRecommendations: any[];
}) {
  const router = useRouter();
  const scale = insp.scale || 'safe_unsafe_na';
  const locked = !!insp.submitted_at;

  const [secNo, setSecNo] = useState<number>(sections[0]?.section_no ?? 1);
  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers);
  const [recs, setRecs] = useState<Record<string, any>>(initialRecs);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Deficient Item / Finding Drawer State
  const [editingQ, setEditingQ] = useState<any | null>(null);
  const [editingValue, setEditingValue] = useState<string>('unsafe');
  const [recTitle, setRecTitle] = useState('');
  const [recText, setRecText] = useState('');
  const [recPriority, setRecPriority] = useState<'High' | 'Med' | 'Low'>('Med');
  const [recTrigger, setRecTrigger] = useState('Regulatory');
  const [recScope, setRecScope] = useState<'site_specific' | 'corporate'>('site_specific');
  const [recLossTrend, setRecLossTrend] = useState(false);
  const [measuredVal, setMeasuredVal] = useState<string>('');
  const [actionOwner, setActionOwner] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [itemNote, setItemNote] = useState('');

  // Book of Recommendations / Standalone Finding Drawer
  const [addingBookFinding, setAddingBookFinding] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addText, setAddText] = useState('');
  const [addTrigger, setAddTrigger] = useState('Regulatory');
  const [addPriority, setAddPriority] = useState<'High' | 'Med' | 'Low'>('Med');
  const [addScope, setAddScope] = useState<'site_specific' | 'corporate'>('site_specific');
  const [addLossTrend, setAddLossTrend] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');

  // ARU Packet Metadata Drawer
  const [metaDrawer, setMetaDrawer] = useState(false);
  const [employeesOnSite, setEmployeesOnSite] = useState<string>(
    String(insp.meta?.employeesOnSite ?? insp.site_employees ?? '')
  );
  const [serviceAreaProfile, setServiceAreaProfile] = useState<string>(
    insp.meta?.serviceAreaProfile || 'Local (<50 mi): 70% · Intermediate (50–200 mi): 25% · Long-Haul (>200 mi): 5%'
  );
  const [claimsAl, setClaimsAl] = useState<string>(insp.meta?.claimsSummary?.AL || '0 claims · $0 incurred');
  const [claimsApd, setClaimsApd] = useState<string>(insp.meta?.claimsSummary?.APD || '0 claims · $0 incurred');
  const [claimsGl, setClaimsGl] = useState<string>(insp.meta?.claimsSummary?.GL || '0 claims · $0 incurred');
  const [claimsWc, setClaimsWc] = useState<string>(insp.meta?.claimsSummary?.WC || '2 claims · $18,400 incurred');
  const [futureTraining, setFutureTraining] = useState<string>(
    insp.meta?.futureTrainingNeeds || 'Supervisor Incident Investigation; Outdoor/Indoor Heat Illness Refresher'
  );
  const [ccList, setCcList] = useState<string>(
    insp.meta?.ccList ||
      [insp.broker_name && `${insp.broker_name} (${insp.broker_firm || 'Broker'})`, 'ARU Captive Underwriting']
        .filter(Boolean)
        .join(', ')
  );
  const [rcaOverridePrompt, setRcaOverridePrompt] = useState<string | null>(null);

  const secQuestions = questions.filter(q => q.section_no === secNo);
  const answeredCount = Object.keys(answers).length;

  // Live Score Computations
  const lceSummary = useMemo(() => {
    if (scale !== 'lce_100') return null;
    let earned = 0;
    let possible = 0;
    for (const q of questions) {
      const a = answers[q.question_id];
      const maxPts = q.threshold !== null && q.threshold !== undefined ? Number(q.threshold) : 5;
      if (a?.value === 'na') continue;
      possible += maxPts;
      if (a?.value === 'points' && a.measured_value != null) earned += Number(a.measured_value);
    }
    return { earned: Math.round(earned * 10) / 10, possible };
  }, [scale, questions, answers]);

  const autoFleetTotal = useMemo(() => {
    if (scale !== 'auto_sup_1_5') return null;
    let sum = 0;
    let count = 0;
    for (const q of questions) {
      const v = answers[q.question_id]?.value;
      if (v && v.startsWith('score_')) {
        sum += Number(v.replace('score_', ''));
        count++;
      }
    }
    const band = sum === 0 ? 'Unrated' : sum <= 15 ? 'Preferred Fleet' : sum <= 27 ? 'Acceptable Fleet' : 'Elevated Fleet Risk';
    return { sum, count, band };
  }, [scale, questions, answers]);

  const rcaStats = useMemo(() => {
    if (scale !== 'rca_percent') return null;
    let acc = 0;
    let ni = 0;
    for (const q of questions) {
      const v = answers[q.question_id]?.value;
      if (v === 'acceptable') acc++;
      else if (v === 'needs_improvement') ni++;
    }
    const applicable = acc + ni;
    const pct = applicable > 0 ? Math.round((acc / applicable) * 1000) / 10 : 0;
    const emp = Number(employeesOnSite || 0);
    return { acc, ni, applicable, pct, emp, qualifies: emp >= 2 && applicable >= 30 };
  }, [scale, questions, answers, employeesOnSite]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  async function recordAnswer(q: any, value: string, extra: Record<string, any> = {}) {
    if (locked) return;
    setAnswers(prev => ({
      ...prev,
      [q.question_id]: {
        ...prev[q.question_id],
        value,
        measured_value: extra.measuredValue ?? prev[q.question_id]?.measured_value ?? null,
        note: extra.note ?? prev[q.question_id]?.note ?? null,
        action_owner: extra.actionOwner ?? prev[q.question_id]?.action_owner ?? null,
        target_date: extra.targetDate ?? prev[q.question_id]?.target_date ?? null,
      },
    }));
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
      const deficient = ['unsafe', 'not_addressed', 'partial', 'needs_improvement', 'score_4', 'score_5'].includes(value);
      if (deficient || extra.raiseRec) {
        setRecs(prev => ({
          ...prev,
          [q.question_id]: {
            title: extra.recTitle || q.question_text.slice(0, 90),
            text: extra.recText || q.recommendation,
            priority: extra.priority || q.priority,
            trigger_type: extra.triggerType || 'Regulatory',
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

  function openDeficiencyDrawer(q: any, targetVal: string) {
    if (locked) return;
    const existing = recs[q.question_id];
    const ans = answers[q.question_id];
    setEditingQ(q);
    setEditingValue(targetVal);
    setRecTitle(existing?.title || q.question_text.slice(0, 100));
    setRecText(existing?.text || q.recommendation || '');
    setRecPriority(existing?.priority || q.priority || 'Med');
    setRecTrigger(existing?.trigger_type || 'Regulatory');
    setRecScope(existing?.scope || 'site_specific');
    setRecLossTrend(Boolean(existing?.is_loss_trend));
    setMeasuredVal(ans?.measured_value != null ? String(ans.measured_value) : '');
    setActionOwner(ans?.action_owner || '');
    setTargetDate(ans?.target_date ? String(ans.target_date).slice(0, 10) : '');
    setItemNote(ans?.note || '');
  }

  async function saveDeficiencyFinding(e: React.FormEvent) {
    e.preventDefault();
    if (!editingQ) return;
    setBusy(true);
    await recordAnswer(editingQ, editingValue, {
      recTitle,
      recText,
      priority: recPriority,
      triggerType: recTrigger,
      scope: recScope,
      isLossTrend: recLossTrend,
      measuredValue: measuredVal !== '' ? Number(measuredVal) : null,
      actionOwner: actionOwner || null,
      targetDate: targetDate || null,
      note: itemNote || null,
      raiseRec: true,
    });
    setBusy(false);
    setEditingQ(null);
    notify(`Saved item ${editingQ.question_id} & recommendation.`);
  }

  async function savePacketMeta(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/field', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update_meta',
        inspectionId: insp.id,
        meta: {
          employeesOnSite: employeesOnSite !== '' ? Number(employeesOnSite) : null,
          serviceAreaProfile,
          claimsSummary: { AL: claimsAl, APD: claimsApd, GL: claimsGl, WC: claimsWc },
          futureTrainingNeeds: futureTraining,
          ccList,
        },
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMetaDrawer(false);
      notify('ARU report packet metadata saved.');
      router.refresh();
    }
  }

  async function submitBookOrStandaloneFinding(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/field', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'add_finding',
        inspectionId: insp.id,
        bookRecId: selectedBookId || undefined,
        title: addTitle,
        text: addText,
        triggerType: addTrigger,
        priority: addPriority,
        scope: addScope,
        isLossTrend: addLossTrend,
      }),
    });
    const body = await res.json();

    if (res.ok && photoDataUrl && body.recId) {
      await fetch('/api/field', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'upload_photo',
          inspectionId: insp.id,
          recId: body.recId,
          photoDataUrl,
          caption: photoCaption || addTitle,
        }),
      });
    }

    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setAddingBookFinding(false);
      setSelectedBookId('');
      setAddTitle('');
      setAddText('');
      setPhotoDataUrl('');
      setPhotoCaption('');
      router.refresh();
    }
  }

  async function submitInspection(waiveRcaRule = false) {
    if (locked) return;
    setBusy(true);
    const res = await fetch('/api/field', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'submit',
        inspectionId: insp.id,
        employeesOnSite: employeesOnSite !== '' ? Number(employeesOnSite) : undefined,
        waiveRcaRule,
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (res.ok) {
      setRcaOverridePrompt(null);
      notify(body.message);
      router.push(`/inspections/${insp.id}/report`);
      router.refresh();
    } else if (body.requiresRcaOverride) {
      setRcaOverridePrompt(body.error);
    } else {
      notify(body.error || 'Could not submit assessment');
    }
  }

  const totalFindingsCount = Object.keys(recs).length + standaloneRecs.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Arrival Prep Banner */}
      {priorSiteRecs.length > 0 && (
        <div className="frame warn" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kicker" style={{ color: 'var(--warn7)' }}>
              Arrival Prep · {priorSiteRecs.length} Prior Open / Assumed Findings at {insp.site}
            </span>
            <Pill kind="unassigned">Verify on Floor</Pill>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
            {priorSiteRecs.slice(0, 3).map(p => (
              <div key={p.id}>
                <strong>
                  {p.rec_number || p.id} ({p.status === 'assumed' ? 'Risk Assumed' : 'Open · due ' + fmtShort(p.due_on)}):
                </strong>{' '}
                {p.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scale-Specific Live Scorecard / Qualification Banner */}
      {scale === 'lce_100' && lceSummary && (
        <Frame style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="kicker">ARU 100-Point Loss Control Evaluation (LCE) Live Tally</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {lceSummary.earned} / {lceSummary.possible || 100} Points Awarded
            </div>
          </div>
          <Pill kind={lceSummary.earned >= 80 ? 'ok' : lceSummary.earned >= 65 ? 'amber' : 'overdue'}>
            {lceSummary.earned >= 80 ? 'Preferred Risk (≥80)' : lceSummary.earned >= 65 ? 'Standard Risk (65–79)' : 'Action Plan Needed (<65)'}
          </Pill>
        </Frame>
      )}

      {scale === 'auto_sup_1_5' && autoFleetTotal && (
        <Frame style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="kicker">ARU Auto / Fleet Supplement (9 Areas · Lower Score = Stronger Controls)</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              Composite Rating: {autoFleetTotal.sum} / 45 ({autoFleetTotal.count}/9 areas rated) · {autoFleetTotal.band}
            </div>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => setMetaDrawer(true)}>
            Edit Service Area Mileage Profile
          </button>
        </Frame>
      )}

      {scale === 'rca_percent' && rcaStats && (
        <Frame className={rcaStats.qualifies ? '' : 'warn'} style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="kicker">ARU Construction Part II — Jobsite Risk Control Assessment (RCA)</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>
              Compliance Score: {rcaStats.pct}% ({rcaStats.acc} Acceptable / {rcaStats.applicable} Applicable Items)
            </div>
            <div className="sub">
              Qualification Rule: ≥2 Company Employees on Site &amp; ≥30 Applicable Items Rated ({rcaStats.applicable}/30 rated)
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label className="kicker" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Employees on Site:
              <input
                type="number"
                min={0}
                className="input"
                value={employeesOnSite}
                disabled={locked}
                onChange={e => setEmployeesOnSite(e.target.value)}
                onBlur={() => savePacketMeta()}
                style={{ width: 78, height: 32 }}
              />
            </label>
            <Pill kind={rcaStats.qualifies ? 'verified' : 'amber'}>
              {rcaStats.qualifies ? 'RCA Qualified' : 'Below 2 Emp / 30 Item Rule'}
            </Pill>
          </div>
        </Frame>
      )}

      {rcaOverridePrompt && (
        <div className="banner warn" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span>{rcaOverridePrompt}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => submitInspection(true)}>
              Confirm Supervisor Override &amp; Submit
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setRcaOverridePrompt(null)}>
              Continue Rating Items
            </button>
          </div>
        </div>
      )}

      {/* Progress & Submit Bar */}
      <Frame
        className="strong"
        style={{
          padding: '14px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div>
          <div className="kicker">
            Assessment Progress · {answeredCount} of {questions.length} Items Rated
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>
            {totalFindingsCount} Numbered Recommendations Raised · Consultant: {insp.consultant}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {!locked && (
            <>
              <button type="button" className="btn btn-sm" onClick={() => setMetaDrawer(true)}>
                ✎ ARU Cover Letter &amp; Claims Meta
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setAddingBookFinding(true)}>
                + Insert Finding / Book of Recs
              </button>
            </>
          )}
          <Link href={`/inspections/${insp.id}`} className="btn btn-sm">
            Console View
          </Link>
          {!locked ? (
            <button className="btn btn-primary" disabled={busy} onClick={() => submitInspection(false)}>
              {busy ? 'Submitting…' : 'Submit & Lock (7-Yr Immutable) →'}
            </button>
          ) : (
            <Pill kind="verified">Submitted &amp; Locked</Pill>
          )}
        </div>
      </Frame>

      <div className="split">
        {/* Section Navigator */}
        <div className="frame" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <div className="kicker" style={{ padding: '11px 16px', borderBottom: '1px solid var(--div)' }}>
            Sections ({sections.length})
          </div>
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
                <span className="kicker" style={{ width: 20 }}>
                  {s.section_no}
                </span>
                <span style={{ flex: 1, lineHeight: 1.3, textAlign: 'left' }}>
                  {s.name}
                  {s.max_points ? <span className="sub"> ({s.max_points} pts)</span> : null}
                </span>
                <span className="kicker" style={{ color: doneCount === secQs.length && secQs.length > 0 ? 'var(--ok)' : undefined }}>
                  {doneCount}/{secQs.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Multi-Scale Item Walkthrough */}
        <div className="frame strong" style={{ minWidth: 0 }}>
          <div className="panel-head">
            <h2>
              {secNo} · {sections.find(s => s.section_no === secNo)?.name}
            </h2>
            <span className="kicker">{scale}</span>
          </div>

          {secQuestions.map(q => {
            const ans = answers[q.question_id];
            const cur = ans?.value;
            const rec = recs[q.question_id];
            const isDeficient = ['unsafe', 'not_addressed', 'partial', 'needs_improvement', 'score_4', 'score_5'].includes(cur);
            const maxPts = q.threshold !== null && q.threshold !== undefined ? Number(q.threshold) : 5;

            return (
              <div
                key={q.question_id}
                style={{
                  padding: '15px 18px',
                  borderTop: '1px solid var(--div2)',
                  background: isDeficient ? 'var(--bad1)' : '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span className="code" style={{ minWidth: 38, paddingTop: 2 }}>
                    {q.question_id}
                  </span>
                  <div style={{ flex: 1, fontSize: 14, lineHeight: 1.45, fontWeight: 500 }}>{q.question_text}</div>
                </div>

                {/* Scale Controls */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingLeft: 48, alignItems: 'center' }}>
                  {scale === 'safe_unsafe_na' && (
                    <>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => recordAnswer(q, 'safe')}
                        className="btn btn-sm"
                        style={{
                          background: cur === 'safe' ? 'var(--ok)' : '#fff',
                          color: cur === 'safe' ? '#fff' : 'var(--ink)',
                        }}
                      >
                        Safe
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => openDeficiencyDrawer(q, 'unsafe')}
                        className="btn btn-sm"
                        style={{
                          background: cur === 'unsafe' ? 'var(--bad)' : '#fff',
                          color: cur === 'unsafe' ? '#fff' : 'var(--ink)',
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
                        }}
                      >
                        N/A
                      </button>
                    </>
                  )}

                  {scale === 'policy_gap' && (
                    <>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => recordAnswer(q, 'addressed')}
                        className="btn btn-sm"
                        style={{
                          background: cur === 'addressed' ? 'var(--ok)' : '#fff',
                          color: cur === 'addressed' ? '#fff' : 'var(--ink)',
                        }}
                      >
                        ✓ Addressed in Policy
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => openDeficiencyDrawer(q, 'partial')}
                        className="btn btn-sm"
                        style={{
                          background: cur === 'partial' ? 'var(--warn7)' : '#fff',
                          color: cur === 'partial' ? '#fff' : 'var(--ink)',
                        }}
                      >
                        ◐ Partially Covered
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => openDeficiencyDrawer(q, 'not_addressed')}
                        className="btn btn-sm"
                        style={{
                          background: cur === 'not_addressed' ? 'var(--bad)' : '#fff',
                          color: cur === 'not_addressed' ? '#fff' : 'var(--ink)',
                        }}
                      >
                        ✗ Not Addressed
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => recordAnswer(q, 'na', { naReason: 'Not applicable to operations' })}
                        className="btn btn-sm"
                        style={{
                          background: cur === 'na' ? 'var(--n7)' : '#fff',
                          color: cur === 'na' ? '#fff' : 'var(--ink)',
                        }}
                      >
                        N/A
                      </button>
                    </>
                  )}

                  {scale === 'lce_100' && (
                    <>
                      <span className="kicker">Points (0–{maxPts}):</span>
                      <input
                        type="number"
                        min={0}
                        max={maxPts}
                        step="0.5"
                        className="input mono"
                        disabled={locked}
                        defaultValue={cur === 'points' && ans?.measured_value != null ? ans.measured_value : ''}
                        onBlur={e => {
                          if (e.target.value === '') return;
                          const pts = Math.max(0, Math.min(maxPts, Number(e.target.value)));
                          recordAnswer(q, 'points', { measuredValue: pts });
                        }}
                        style={{ width: 88, height: 32 }}
                      />
                      <button
                        type="button"
                        disabled={locked}
                        className="btn btn-sm"
                        onClick={() => recordAnswer(q, 'points', { measuredValue: maxPts })}
                      >
                        Full ({maxPts} pts)
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        className="btn btn-sm"
                        onClick={() => openDeficiencyDrawer(q, 'points')}
                      >
                        + Raise Recommendation
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        className="btn btn-sm"
                        onClick={() => recordAnswer(q, 'na', { naReason: 'Not applicable' })}
                        style={{
                          background: cur === 'na' ? 'var(--n7)' : '#fff',
                          color: cur === 'na' ? '#fff' : 'var(--ink)',
                        }}
                      >
                        N/A
                      </button>
                    </>
                  )}

                  {scale === 'auto_sup_1_5' &&
                    (
                      [
                        ['score_1', '1 · Excellent'],
                        ['score_2', '2 · Good'],
                        ['score_3', '3 · Average'],
                        ['score_4', '4 · Fair'],
                        ['score_5', '5 · Poor'],
                      ] as const
                    ).map(([val, lbl]) => {
                      const needsFinding = val === 'score_4' || val === 'score_5';
                      return (
                        <button
                          key={val}
                          type="button"
                          disabled={locked}
                          onClick={() => (needsFinding ? openDeficiencyDrawer(q, val) : recordAnswer(q, val))}
                          className="btn btn-sm"
                          style={{
                            background:
                              cur === val ? (needsFinding ? 'var(--bad)' : 'var(--acc)') : '#fff',
                            color: cur === val ? '#fff' : 'var(--ink)',
                          }}
                        >
                          {lbl}
                        </button>
                      );
                    })}

                  {scale === 'rca_percent' && (
                    <>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => recordAnswer(q, 'acceptable')}
                        className="btn btn-sm"
                        style={{
                          background: cur === 'acceptable' ? 'var(--ok)' : '#fff',
                          color: cur === 'acceptable' ? '#fff' : 'var(--ink)',
                        }}
                      >
                        Acceptable
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => openDeficiencyDrawer(q, 'needs_improvement')}
                        className="btn btn-sm"
                        style={{
                          background: cur === 'needs_improvement' ? 'var(--bad)' : '#fff',
                          color: cur === 'needs_improvement' ? '#fff' : 'var(--ink)',
                        }}
                      >
                        Needs Improvement
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => recordAnswer(q, 'na', { naReason: 'Not active on jobsite today' })}
                        className="btn btn-sm"
                        style={{
                          background: cur === 'na' ? 'var(--n7)' : '#fff',
                          color: cur === 'na' ? '#fff' : 'var(--ink)',
                        }}
                      >
                        N/A
                      </button>
                    </>
                  )}

                  {scale === 'maturity' &&
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
                          textTransform: 'uppercase',
                        }}
                      >
                        {lv}
                      </button>
                    ))}

                  <Pill kind="line">{q.topic}</Pill>
                </div>

                {rec && (
                  <div
                    style={{
                      marginLeft: 48,
                      padding: '10px 12px',
                      background: '#fff',
                      border: '1px solid var(--bad)',
                      fontSize: 12.5,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div>
                      <span className="kicker" style={{ color: 'var(--bad)' }}>
                        {rec.rec_number || 'Rec'} ({rec.priority} · {rec.trigger_type || 'Regulatory'}):
                      </span>{' '}
                      <strong>{rec.title ? `${rec.title} — ` : ''}</strong>
                      {rec.text}
                    </div>
                    {!locked && (
                      <button type="button" className="btn btn-sm" onClick={() => openDeficiencyDrawer(q, cur || 'unsafe')}>
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* DEFICIENCY / POLICY GAP ACTION PLAN DRAWER */}
      {editingQ && (
        <>
          <div className="drawer-bg" onClick={() => setEditingQ(null)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 620, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">
                  Item {editingQ.question_id} · {editingQ.topic} · {insp.jurisdiction}
                </div>
                <h2>Record Finding &amp; Corrective Action Plan</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setEditingQ(null)}>
                ×
              </button>
            </div>
            <form onSubmit={saveDeficiencyFinding} className="drawer-body">
              <div className="note">{editingQ.question_text}</div>

              <label className="field">
                <span>Recommendation Title (prints bold on ARU Cover Letter &amp; 30-Day Response Form)</span>
                <input className="input" value={recTitle} onChange={e => setRecTitle(e.target.value)} required />
              </label>

              <label className="field">
                <span>Corrective Action Wording</span>
                <textarea
                  className="input"
                  rows={4}
                  value={recText}
                  onChange={e => setRecText(e.target.value)}
                  required
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Trigger Type</span>
                  <select className="select" value={recTrigger} onChange={e => setRecTrigger(e.target.value)}>
                    {['Regulatory', 'Best Practice', 'Program', 'Training', 'Maintenance', 'Record Keeping'].map(tr => (
                      <option key={tr} value={tr}>
                        {tr}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Priority</span>
                  <select className="select" value={recPriority} onChange={e => setRecPriority(e.target.value as any)}>
                    <option value="High">High ({PRIORITY_DAYS.High}d)</option>
                    <option value="Med">Med ({PRIORITY_DAYS.Med}d)</option>
                    <option value="Low">Low ({PRIORITY_DAYS.Low}d)</option>
                  </select>
                </label>
                <label className="field">
                  <span>Scope</span>
                  <select className="select" value={recScope} onChange={e => setRecScope(e.target.value as any)}>
                    <option value="site_specific">Site Specific</option>
                    <option value="corporate">Corporate-Wide</option>
                  </select>
                </label>
              </div>

              {scale === 'policy_gap' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="field">
                    <span>Assigned Policy Action Owner</span>
                    <input
                      className="input"
                      value={actionOwner}
                      onChange={e => setActionOwner(e.target.value)}
                      placeholder="HR / Safety Director"
                    />
                  </label>
                  <label className="field">
                    <span>Target Remediation Date</span>
                    <input
                      className="input"
                      type="date"
                      value={targetDate}
                      onChange={e => setTargetDate(e.target.value)}
                    />
                  </label>
                </div>
              )}

              {scale === 'lce_100' && (
                <label className="field">
                  <span>Points Awarded</span>
                  <input
                    className="input"
                    type="number"
                    step="0.5"
                    value={measuredVal}
                    onChange={e => setMeasuredVal(e.target.value)}
                  />
                </label>
              )}

              <label className="field">
                <span>Consultant Review Note (Optional)</span>
                <input className="input" value={itemNote} onChange={e => setItemNote(e.target.value)} />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={recLossTrend}
                  onChange={e => setRecLossTrend(e.target.checked)}
                />
                <span>
                  <strong>Related to Member Loss Trend</strong> (groups under primary loss-driver section on ARU Cover
                  Letter)
                </span>
              </label>

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Save Finding
                </button>
                <button type="button" className="btn" onClick={() => setEditingQ(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* BOOK OF RECOMMENDATIONS / STANDALONE FINDING + PHOTO DRAWER */}
      {addingBookFinding && (
        <>
          <div className="drawer-bg" onClick={() => setAddingBookFinding(false)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 620, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Book of Recommendations &amp; Site Photo Capture</div>
                <h2>Insert Standardized or Custom Recommendation</h2>
              </div>
              <button
                className="btn"
                style={{ width: 36, height: 36, padding: 0 }}
                onClick={() => setAddingBookFinding(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={submitBookOrStandaloneFinding} className="drawer-body">
              <label className="field">
                <span>1-Click Pre-Fill from Book of Recommendations</span>
                <select
                  className="select"
                  value={selectedBookId}
                  onChange={e => {
                    const id = e.target.value;
                    setSelectedBookId(id);
                    const br = bookRecommendations.find(x => x.id === id);
                    if (br) {
                      setAddTitle(br.title);
                      setAddText(br.body);
                      setAddTrigger(br.trigger_type || 'Regulatory');
                      setAddPriority(br.priority || 'Med');
                      setAddScope(br.scope || 'site_specific');
                    }
                  }}
                >
                  <option value="">— Write Custom Site Finding or Pick Standard Entry —</option>
                  {bookRecommendations.map(b => (
                    <option key={b.id} value={b.id}>
                      [{b.trigger_type}] {b.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Recommendation Title</span>
                <input className="input" value={addTitle} onChange={e => setAddTitle(e.target.value)} required />
              </label>

              <label className="field">
                <span>Corrective Action Wording</span>
                <textarea className="input" rows={4} value={addText} onChange={e => setAddText(e.target.value)} required />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Trigger</span>
                  <select className="select" value={addTrigger} onChange={e => setAddTrigger(e.target.value)}>
                    {['Regulatory', 'Best Practice', 'Program', 'Training', 'Maintenance', 'Record Keeping'].map(tr => (
                      <option key={tr} value={tr}>
                        {tr}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Priority</span>
                  <select className="select" value={addPriority} onChange={e => setAddPriority(e.target.value as any)}>
                    <option value="High">High</option>
                    <option value="Med">Med</option>
                    <option value="Low">Low</option>
                  </select>
                </label>
                <label className="field">
                  <span>Scope</span>
                  <select className="select" value={addScope} onChange={e => setAddScope(e.target.value as any)}>
                    <option value="site_specific">Site Specific</option>
                    <option value="corporate">Corporate-Wide</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={addLossTrend}
                  onChange={e => setAddLossTrend(e.target.checked)}
                />
                <span>Related to Loss Trend</span>
              </label>

              <div className="frame" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="kicker">Attach Location Evidence Photo (appears on ARU 2-Column Photo Page)</div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="input"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => setPhotoDataUrl(String(r.result || ''));
                    r.readAsDataURL(f);
                  }}
                />
                {photoDataUrl && (
                  <input
                    className="input"
                    value={photoCaption}
                    onChange={e => setPhotoCaption(e.target.value)}
                    placeholder="Location / Photo Caption (e.g. West Packing Line — Unshielded Drive Chain)"
                  />
                )}
              </div>

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Add Numbered Recommendation
                </button>
                <button type="button" className="btn" onClick={() => setAddingBookFinding(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* ARU PACKET METADATA DRAWER */}
      {metaDrawer && (
        <>
          <div className="drawer-bg" onClick={() => setMetaDrawer(false)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 600, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">ARU Base Report Packet Metadata</div>
                <h2>Claims Summary, Fleet Profile &amp; Cover Letter</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setMetaDrawer(false)}>
                ×
              </button>
            </div>
            <form onSubmit={savePacketMeta} className="drawer-body">
              <label className="field">
                <span>Company Employees on Site</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={employeesOnSite}
                  onChange={e => setEmployeesOnSite(e.target.value)}
                />
              </label>

              <label className="field">
                <span>Service Area Mileage Profile (for Auto Supplement)</span>
                <input
                  className="input"
                  value={serviceAreaProfile}
                  onChange={e => setServiceAreaProfile(e.target.value)}
                />
              </label>

              <div className="kicker">Multi-Line Loss / Claims Summary (AL · APD · GL · WC)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Auto Liability (AL)</span>
                  <input className="input" value={claimsAl} onChange={e => setClaimsAl(e.target.value)} />
                </label>
                <label className="field">
                  <span>Auto Physical Damage (APD)</span>
                  <input className="input" value={claimsApd} onChange={e => setClaimsApd(e.target.value)} />
                </label>
                <label className="field">
                  <span>General Liability (GL)</span>
                  <input className="input" value={claimsGl} onChange={e => setClaimsGl(e.target.value)} />
                </label>
                <label className="field">
                  <span>Workers&apos; Compensation (WC)</span>
                  <input className="input" value={claimsWc} onChange={e => setClaimsWc(e.target.value)} />
                </label>
              </div>

              <label className="field">
                <span>Future Training &amp; Loss Control Service Needs</span>
                <textarea
                  className="input"
                  rows={2}
                  value={futureTraining}
                  onChange={e => setFutureTraining(e.target.value)}
                />
              </label>

              <label className="field">
                <span>Cover Letter cc: Distribution List (Broker &amp; Captive)</span>
                <input className="input" value={ccList} onChange={e => setCcList(e.target.value)} />
              </label>

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Save Packet Metadata
                </button>
                <button type="button" className="btn" onClick={() => setMetaDrawer(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
