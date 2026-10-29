'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pill } from './ui';
import { PRIORITY_DAYS } from '@/lib/format';

export default function FormSectionView({
  form,
  current,
  questions,
  canEdit,
}: {
  form: any;
  current: any;
  questions: any[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const maturity = form.scale === 'maturity';
  const [open, setOpen] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Edit question state
  const [qText, setQText] = useState('');
  const [qRec, setQRec] = useState('');
  const [qPriority, setQPriority] = useState('Med');
  const [qTopic, setQTopic] = useState('');
  const [qUnit, setQUnit] = useState('');
  const [qThreshold, setQThreshold] = useState('');
  const [qComp, setQComp] = useState('min');
  const [qPhoto, setQPhoto] = useState(false);
  const [qNa, setQNa] = useState('');
  const [detach, setDetach] = useState(false);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  function selectQuestion(x: any) {
    if (!canEdit) return;
    setOpen(x);
    setQText(x.question_text ?? '');
    setQRec(x.recommendation ?? '');
    setQPriority(x.priority ?? 'Med');
    setQTopic(x.topic ?? 'general');
    setQUnit(x.measure_unit ?? '');
    setQThreshold(x.threshold !== null && x.threshold !== undefined ? String(Number(x.threshold)) : '');
    setQComp(x.comparison ?? 'min');
    setQPhoto(!!x.photo_required);
    setQNa(x.na_label ?? '');
    setDetach(false);
  }

  function openCreate() {
    setCreating(true);
    setQText('');
    setQRec('');
    setQPriority('Med');
    setQTopic('general');
    setQUnit('');
    setQThreshold('');
    setQComp('min');
    setQPhoto(false);
    setQNa('');
  }

  async function saveQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!open) return;
    setBusy(true);
    const res = await fetch(`/api/forms/${form.code}/questions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        questionId: open.question_id,
        questionText: qText,
        recommendation: qRec,
        priority: qPriority,
        topic: qTopic,
        measureUnit: qUnit || null,
        threshold: qThreshold !== '' ? Number(qThreshold) : null,
        comparison: qThreshold !== '' ? qComp : null,
        photoRequired: qPhoto,
        naLabel: qNa || null,
        detach,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setOpen(null);
      router.refresh();
    }
  }

  async function createQuestion(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/forms/${form.code}/questions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        sectionNo: current.section_no,
        questionText: qText,
        recommendation: qRec,
        priority: qPriority,
        topic: qTopic,
        measureUnit: qUnit || null,
        threshold: qThreshold !== '' ? Number(qThreshold) : null,
        comparison: qThreshold !== '' ? qComp : null,
        photoRequired: qPhoto,
        naLabel: qNa || null,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setCreating(false);
      router.refresh();
    }
  }

  return (
    <>
      <div className="frame strong" style={{ minWidth: 0 }}>
        <div className="panel-head">
          <h2>{current.section_no} · {current.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="kicker">{maturity ? 'Absent · Written · Practiced · Owned' : 'Safe · Unsafe · N/A'}</span>
            {canEdit && (
              <button className="btn btn-sm" onClick={openCreate}>+ Add question</button>
            )}
          </div>
        </div>
        {questions.map((x: any) => (
          <div
            key={x.question_id}
            onClick={() => selectQuestion(x)}
            style={{
              display: 'grid',
              gridTemplateColumns: '44px minmax(0,1fr)',
              gap: 12,
              padding: '13px 18px',
              borderTop: '1px solid var(--div2)',
              cursor: canEdit ? 'pointer' : 'default',
            }}
          >
            <span className="code" style={{ paddingTop: 2 }}>{x.question_id}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>{x.question_text}</span>
              {x.recommendation && <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--n6)' }}>{maturity ? 'Development step: ' : ''}{x.recommendation}</span>}
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {!maturity && <Pill kind="ink">{x.priority} · {PRIORITY_DAYS[x.priority as keyof typeof PRIORITY_DAYS]} days</Pill>}
                {x.threshold !== null && <Pill kind="acc">{(x.comparison === 'min' ? '≥ ' : '≤ ') + Number(x.threshold) + ' ' + (x.measure_unit ?? '')}</Pill>}
                <Pill kind="line">{x.topic}</Pill>
                {!!x.photo_required && <Pill kind="line">Photo required</Pill>}
                {x.na_label && <Pill kind="line">N/A: {x.na_label}</Pill>}
                {!!x.is_shared && <Pill kind="shared">Shared · {x.question_key} ({x.shared_forms_count} forms)</Pill>}
              </span>
            </div>
          </div>
        ))}
        {questions.length === 0 && <div style={{ padding: 18, fontSize: 13, color: 'var(--n6)' }}>No questions in this section match.</div>}
      </div>

      {open && (
        <>
          <div className="drawer-bg" onClick={() => setOpen(null)} />
          <aside className="drawer" role="dialog" aria-label={'Question ' + open.question_id}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">{form.code} · Q {open.question_id} · {open.question_key}</div>
                <h2>Edit Question (bumps form to v{Number(form.version) + 1})</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setOpen(null)} aria-label="Close">×</button>
            </div>
            <form onSubmit={saveQuestion} className="drawer-body">
              {!!open.is_shared && (
                <div className="banner warn" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <strong>Shared question ({open.question_key}) — Used by {open.shared_forms_count} forms.</strong>{' '}
                    Saving updates this question across all {open.shared_forms_count} forms unless you detach it below.
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer', color: 'var(--ink)' }}>
                    <input type="checkbox" checked={detach} onChange={e => setDetach(e.target.checked)} />
                    <span><strong>Detach from shared library</strong> — create a form-specific copy for {form.code} only</span>
                  </label>
                </div>
              )}

              <label className="field">
                <span>Question text</span>
                <textarea className="input" rows={3} value={qText} onChange={e => setQText(e.target.value)} required style={{ width: '100%' }} />
              </label>

              <label className="field">
                <span>{maturity ? 'Development step' : 'Default recommendation text (pre-filled when Unsafe)'}</span>
                <textarea className="input" rows={3} value={qRec} onChange={e => setQRec(e.target.value)} style={{ width: '100%' }} />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: maturity ? '1fr' : '140px 1fr', gap: 10 }}>
                {!maturity && (
                  <label className="field">
                    <span>Priority</span>
                    <select className="select" value={qPriority} onChange={e => setQPriority(e.target.value)}>
                      <option value="High">High (7 days)</option>
                      <option value="Med">Med (30 days)</option>
                      <option value="Low">Low (60 days)</option>
                    </select>
                  </label>
                )}
                <label className="field">
                  <span>Regulation Topic key</span>
                  <input className="input" value={qTopic} onChange={e => setQTopic(e.target.value)} required />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Threshold (optional)</span>
                  <input className="input" type="number" step="any" value={qThreshold} onChange={e => setQThreshold(e.target.value)} placeholder="e.g. 36" />
                </label>
                <label className="field">
                  <span>Comparison</span>
                  <select className="select" value={qComp} onChange={e => setQComp(e.target.value)}>
                    <option value="min">≥ Minimum</option>
                    <option value="max">≤ Maximum</option>
                    <option value="exact">= Exact</option>
                    <option value="range">Range</option>
                  </select>
                </label>
                <label className="field">
                  <span>Unit</span>
                  <input className="input" value={qUnit} onChange={e => setQUnit(e.target.value)} placeholder="in / ft / dBA" />
                </label>
              </div>

              <label className="field">
                <span>Custom N/A label (optional)</span>
                <input className="input" value={qNa} onChange={e => setQNa(e.target.value)} placeholder="e.g. No forklifts on site" />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={qPhoto} onChange={e => setQPhoto(e.target.checked)} />
                <span>Require photo when marked Unsafe</span>
              </label>

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {open.is_shared && !detach ? `Save across ${open.shared_forms_count} forms` : 'Save question'}
                </button>
                <button type="button" className="btn" onClick={() => setOpen(null)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {creating && (
        <>
          <div className="drawer-bg" onClick={() => setCreating(false)} />
          <aside className="drawer" role="dialog" aria-label="Add question">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">{form.code} · Section {current.section_no} · {current.name}</div>
                <h2>Add Question</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setCreating(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={createQuestion} className="drawer-body">
              <label className="field">
                <span>Question text</span>
                <textarea className="input" rows={3} value={qText} onChange={e => setQText(e.target.value)} required style={{ width: '100%' }} />
              </label>
              <label className="field">
                <span>{maturity ? 'Development step' : 'Default recommendation text'}</span>
                <textarea className="input" rows={3} value={qRec} onChange={e => setQRec(e.target.value)} style={{ width: '100%' }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: maturity ? '1fr' : '140px 1fr', gap: 10 }}>
                {!maturity && (
                  <label className="field">
                    <span>Priority</span>
                    <select className="select" value={qPriority} onChange={e => setQPriority(e.target.value)}>
                      <option value="High">High (7 days)</option>
                      <option value="Med">Med (30 days)</option>
                      <option value="Low">Low (60 days)</option>
                    </select>
                  </label>
                )}
                <label className="field">
                  <span>Regulation Topic key</span>
                  <input className="input" value={qTopic} onChange={e => setQTopic(e.target.value)} required />
                </label>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={qPhoto} onChange={e => setQPhoto(e.target.checked)} />
                <span>Require photo when marked Unsafe</span>
              </label>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>Add question</button>
                <button type="button" className="btn" onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

