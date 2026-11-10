'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from './ui';
import { PRIORITY_DAYS } from '@/lib/format';

const SCALE_DESCRIPTIONS: Record<string, string> = {
  safe_unsafe_na: 'Safe · Unsafe · N/A',
  maturity: 'Absent · Written · Practiced · Owned · N/A',
  policy_gap: 'Addressed · Partially Covered · Not Addressed · N/A',
  lce_100: '0 .. Max Points (/100 LCE Scorecard)',
  auto_sup_1_5: '1 Excellent · 2 Good · 3 Average · 4 Fair · 5 Poor',
  rca_percent: 'Acceptable · Needs Improvement · N/A (Compliance %)',
};

export default function FormSectionView({
  form,
  current,
  questions,
  regs,
  industries = [],
  canEdit,
  canMaster,
  canTenant = false,
  hasTeamWorkspace = false,
}: {
  form: any;
  current: any;
  questions: any[];
  regs: any[];
  industries?: any[];
  canEdit: boolean;
  canMaster: boolean;
  canTenant?: boolean;
  hasTeamWorkspace?: boolean;
}) {
  const router = useRouter();
  const scale = form.scale || 'safe_unsafe_na';
  const maturity = scale === 'maturity';
  const canCloneAny = canMaster || canTenant;
  const isUnusedForm = Number(form.inspection_count || 0) === 0 && Number(form.visit_count || 0) === 0;

  const [open, setOpen] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState<'add' | 'edit' | 'csv' | null>(null);
  const [showFormSettings, setShowFormSettings] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form Settings state
  const [fName, setFName] = useState(form.name || '');
  const [fCategory, setFCategory] = useState(form.category || 'field_inspection');
  const [fScale, setFScale] = useState(form.scale || 'safe_unsafe_na');
  const [fShieldCode, setFShieldCode] = useState(form.shield_code || '');
  const [fSubsector, setFSubsector] = useState(form.subsector_code || '');
  const [fDesc, setFDesc] = useState(form.description || '');
  const [fAllowAdditional, setFAllowAdditional] = useState(form.allow_additional_findings !== 0);

  // Clone state
  const [clScope, setClScope] = useState<'tenant' | 'platform'>(hasTeamWorkspace && canTenant ? 'tenant' : 'platform');
  const [clCode, setClCode] = useState(`${form.code}-COPY`.slice(0, 16));
  const [clName, setClName] = useState(`${form.name} (Custom)`);

  // Section & CSV Import state
  const [secName, setSecName] = useState(current.name || '');
  const [secMaxPts, setSecMaxPts] = useState(current.max_points != null ? String(current.max_points) : '');
  const [csvText, setCsvText] = useState('');

  // Edit / Create Question state
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
  const [linkRegId, setLinkRegId] = useState('');
  const [linkJur, setLinkJur] = useState('CA');

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
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
    setDetach(!canMaster && Boolean(x.is_shared));
    setLinkRegId('');
  }

  function openCreate() {
    setCreating(true);
    setQText('');
    setQRec('');
    setQPriority('Med');
    setQTopic('general');
    setQUnit(scale === 'lce_100' ? 'pts' : '');
    setQThreshold(scale === 'lce_100' ? '5' : '');
    setQComp(scale === 'lce_100' ? 'max' : 'min');
    setQPhoto(false);
    setQNa('');
    setLinkRegId('');
  }

  async function postFormAction(payload: Record<string, any>, after?: () => void) {
    setBusy(true);
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ formCode: form.code, ...payload }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      if (after) after();
      router.refresh();
    }
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

    if (res.ok && linkRegId) {
      await fetch('/api/regulations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'link_question',
          questionKey: open.question_key,
          jurisdiction: linkJur,
          regId: linkRegId,
          isPrimary: true,
        }),
      });
    }

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
        regId: linkRegId || undefined,
        regJurisdiction: linkJur,
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

  async function reorderQuestion(e: React.MouseEvent, questionId: string, direction: 'up' | 'down') {
    e.stopPropagation();
    setBusy(true);
    const res = await fetch(`/api/forms/${form.code}/questions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reorder', questionId, direction }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function deleteQuestion(questionId: string) {
    setBusy(true);
    const res = await fetch(`/api/forms/${form.code}/questions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete', questionId }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setOpen(null);
      router.refresh();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      {/* Builder Toolbar */}
      <Frame style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pill kind="ink">{SCALE_DESCRIPTIONS[scale] || scale}</Pill>
          {Boolean(form.is_archived) && <Pill kind="overdue">Archived</Pill>}
          <button
            type="button"
            className={'btn btn-sm ' + (previewMode ? 'btn-primary' : '')}
            onClick={() => setPreviewMode(p => !p)}
          >
            {previewMode ? '✎ Back to Builder View' : '👁 Live Field & Report Preview'}
          </button>
          {canCloneAny && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setClCode(`${form.code}-COPY`.slice(0, 16));
                setClName(`${form.name} (Custom)`);
                setShowCloneModal(true);
              }}
            >
              Clone Template
            </button>
          )}
        </div>

        {canEdit && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setFName(form.name || '');
                setFCategory(form.category || 'field_inspection');
                setFScale(form.scale || 'safe_unsafe_na');
                setFShieldCode(form.shield_code || '');
                setFSubsector(form.subsector_code || '');
                setFDesc(form.description || '');
                setFAllowAdditional(form.allow_additional_findings !== 0);
                setShowFormSettings(true);
              }}
            >
              ⚙ Form Settings
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setSecName('');
                setSecMaxPts('');
                setShowSectionModal('add');
              }}
            >
              + Section
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setSecName(current.name);
                setSecMaxPts(current.max_points != null ? String(current.max_points) : '');
                setShowSectionModal('edit');
              }}
            >
              Edit Section {current.section_no}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setShowSectionModal('csv')}>
              ↑ Import CSV
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              onClick={() => postFormAction({ action: 'publish_form' })}
            >
              Publish v{Number(form.version) + 1}
            </button>
            {Boolean(form.is_archived) ? (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={() => postFormAction({ action: 'restore_form' })}
              >
                Restore Form
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Archive template ${form.code}? You can restore it anytime from /forms.`)) {
                    postFormAction({ action: 'archive_form' });
                  }
                }}
              >
                Archive
              </button>
            )}
            {isUnusedForm && (
              <button
                type="button"
                className="btn btn-sm"
                style={{ color: 'var(--bad)' }}
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Permanently delete unused template ${form.code} and all items?`)) {
                    postFormAction({ action: 'delete_form' }, () => router.push('/forms'));
                  }
                }}
              >
                Delete Form
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
              + Add Item
            </button>
          </div>
        )}
      </Frame>

      {/* LIVE FIELD & PRINTABLE PREVIEW PANE */}
      {previewMode ? (
        <Frame className="strong" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ borderBottom: '2px solid var(--acc)', paddingBottom: 10 }}>
            <div className="kicker">Live Field Runner &amp; Report Preview · {form.code} v{form.version}</div>
            <h2 style={{ margin: '4px 0 0' }}>
              Section {current.section_no}: {current.name}
              {current.max_points ? ` (Max ${current.max_points} Points)` : ''}
            </h2>
          </div>

          {questions.map((x: any) => (
            <div
              key={x.question_id}
              style={{
                padding: '12px 14px',
                background: 'var(--bg-soft)',
                border: '1px solid var(--div)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span className="code">{x.question_id}</span>
                <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1 }}>{x.question_text}</span>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {scale === 'safe_unsafe_na' && (
                  <>
                    <span className="btn btn-sm">Safe</span>
                    <span className="btn btn-sm">Unsafe</span>
                    <span className="btn btn-sm">N/A</span>
                  </>
                )}
                {scale === 'policy_gap' && (
                  <>
                    <span className="btn btn-sm">✓ Addressed</span>
                    <span className="btn btn-sm">◐ Partially Covered</span>
                    <span className="btn btn-sm">✗ Not Addressed</span>
                    <span className="btn btn-sm">N/A</span>
                  </>
                )}
                {scale === 'lce_100' && (
                  <span style={{ fontSize: 12.5, fontFamily: 'var(--mono)' }}>
                    Points Awarded: [ 0 .. {x.threshold || current.max_points || 10} pts ]
                  </span>
                )}
                {scale === 'auto_sup_1_5' && (
                  <>
                    {['1 Excellent', '2 Good', '3 Average', '4 Fair', '5 Poor'].map(lbl => (
                      <span key={lbl} className="btn btn-sm">
                        {lbl}
                      </span>
                    ))}
                  </>
                )}
                {scale === 'rca_percent' && (
                  <>
                    <span className="btn btn-sm">Acceptable</span>
                    <span className="btn btn-sm">Needs Improvement</span>
                    <span className="btn btn-sm">N/A</span>
                  </>
                )}
                {scale === 'maturity' && (
                  <>
                    {['Absent', 'Written', 'Practiced', 'Owned', 'N/A'].map(lbl => (
                      <span key={lbl} className="btn btn-sm">
                        {lbl}
                      </span>
                    ))}
                  </>
                )}
              </div>

              {x.recommendation && (
                <div className="sub">
                  <strong>Default Recommendation / Action Plan:</strong> {x.recommendation}
                </div>
              )}
            </div>
          ))}
        </Frame>
      ) : (
        <div className="frame strong" style={{ minWidth: 0 }}>
          <div className="panel-head">
            <h2>
              {current.section_no} · {current.name}
              {current.max_points ? ` (${current.max_points} pts)` : ''}
            </h2>
            {canEdit && questions.length === 0 && (
              <button
                type="button"
                className="btn btn-sm"
                style={{ color: 'var(--bad)' }}
                disabled={busy}
                onClick={() =>
                  postFormAction({ action: 'delete_section', sectionNo: current.section_no }, () =>
                    router.push(`/forms/${form.code}`)
                  )
                }
              >
                Delete Empty Section
              </button>
            )}
          </div>

          {questions.map((x: any, idx: number) => (
            <div
              key={x.question_id}
              onClick={() => selectQuestion(x)}
              style={{
                display: 'grid',
                gridTemplateColumns: '52px minmax(0,1fr) auto',
                gap: 12,
                padding: '13px 18px',
                borderTop: '1px solid var(--div2)',
                cursor: canEdit ? 'pointer' : 'default',
                alignItems: 'start',
              }}
            >
              <span className="code" style={{ paddingTop: 2 }}>
                {x.question_id}
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, lineHeight: 1.45, fontWeight: 500 }}>{x.question_text}</span>
                {x.recommendation && (
                  <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--n6)' }}>
                    {maturity ? 'Development step: ' : 'Default wording: '}
                    {x.recommendation}
                  </span>
                )}
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {!maturity && (
                    <Pill kind="ink">
                      {x.priority} · {PRIORITY_DAYS[x.priority as keyof typeof PRIORITY_DAYS] || 30}d
                    </Pill>
                  )}
                  {x.threshold !== null && x.threshold !== undefined && (
                    <Pill kind="acc">
                      {scale === 'lce_100'
                        ? `Max ${Number(x.threshold)} pts`
                        : `${x.comparison === 'min' ? '≥ ' : '≤ '}${Number(x.threshold)} ${x.measure_unit ?? ''}`}
                    </Pill>
                  )}
                  <Pill kind="line">{x.topic}</Pill>
                  {!!x.photo_required && <Pill kind="line">Photo required</Pill>}
                  {!!x.is_shared && (
                    <Pill kind="shared">
                      Shared · {x.question_key} ({x.shared_forms_count} forms)
                    </Pill>
                  )}
                  {(x.linked_regs || []).map((lr: any) => (
                    <Pill key={`${lr.jurisdiction}-${lr.reg_id}`} kind="verified">
                      § {lr.jurisdiction}: {lr.reg_code}
                    </Pill>
                  ))}
                </span>
              </div>

              {canEdit && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={() => selectQuestion(x)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy || idx === 0}
                    onClick={e => reorderQuestion(e, x.question_id, 'up')}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy || idx === questions.length - 1}
                    onClick={e => reorderQuestion(e, x.question_id, 'down')}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ color: 'var(--bad)' }}
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Remove item ${x.question_id} from ${form.code}?`)) {
                        deleteQuestion(x.question_id);
                      }
                    }}
                    title="Delete item"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
          {questions.length === 0 && (
            <div style={{ padding: 18, fontSize: 13, color: 'var(--n6)' }}>
              No items in this section yet. Click &ldquo;+ Add Item&rdquo; or &ldquo;↑ Import CSV&rdquo; above.
            </div>
          )}
        </div>
      )}

      {/* SECTION ADD / EDIT / CSV IMPORT MODAL DRAWER */}
      {showSectionModal && (
        <>
          <div className="drawer-bg" onClick={() => setShowSectionModal(null)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 560, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">{form.code} Section Builder</div>
                <h2>
                  {showSectionModal === 'add'
                    ? 'Add New Section'
                    : showSectionModal === 'edit'
                    ? `Edit Section ${current.section_no}`
                    : 'Bulk Import Items via CSV'}
                </h2>
              </div>
              <button
                className="btn"
                style={{ width: 36, height: 36, padding: 0 }}
                onClick={() => setShowSectionModal(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {showSectionModal === 'csv' ? (
              <form
                className="drawer-body"
                onSubmit={e => {
                  e.preventDefault();
                  postFormAction({ action: 'import_questions_csv', csvText }, () => {
                    setCsvText('');
                    setShowSectionModal(null);
                  });
                }}
              >
                <div className="note">
                  Paste CSV rows in format:{' '}
                  <code>section_no, question_text, priority (High|Med|Low), topic, default_recommendation, max_points_or_threshold, unit</code>
                </div>
                <textarea
                  className="input mono"
                  rows={8}
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder={`1,"Written policy designates a program administrator by name and title",High,iipp,"Designate a qualified safety coordinator in Section 1 of the written plan."\n2,"Supervisor field audits documented monthly",Med,iipp,"Establish monthly documented supervisor walkthrough checklists."`}
                  required
                />
                <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    Import CSV Rows
                  </button>
                  <button type="button" className="btn" onClick={() => setShowSectionModal(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <form
                className="drawer-body"
                onSubmit={e => {
                  e.preventDefault();
                  postFormAction(
                    showSectionModal === 'add'
                      ? { action: 'add_section', name: secName, maxPoints: secMaxPts || null }
                      : {
                          action: 'update_section',
                          sectionNo: current.section_no,
                          name: secName,
                          maxPoints: secMaxPts || null,
                        },
                    () => setShowSectionModal(null)
                  );
                }}
              >
                <label className="field">
                  <span>Section Title</span>
                  <input className="input" value={secName} onChange={e => setSecName(e.target.value)} required />
                </label>
                <label className="field">
                  <span>Section Max Points (for 100-Pt LCE Scorecards · Optional)</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={secMaxPts}
                    onChange={e => setSecMaxPts(e.target.value)}
                    placeholder="e.g. 25"
                  />
                </label>
                <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    Save Section
                  </button>
                  <button type="button" className="btn" onClick={() => setShowSectionModal(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </aside>
        </>
      )}

      {/* EDIT QUESTION DRAWER */}
      {open && (
        <>
          <div className="drawer-bg" onClick={() => setOpen(null)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 620, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">
                  {form.code} · Item {open.question_id} · {open.question_key}
                </div>
                <h2>Edit Item (bumps to v{Number(form.version) + 1})</h2>
              </div>
              <button
                className="btn"
                style={{ width: 36, height: 36, padding: 0 }}
                onClick={() => setOpen(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={saveQuestion} className="drawer-body">
              {!!open.is_shared && (
                <div className="banner warn" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <strong>
                      Shared item ({open.question_key}) — Used by {open.shared_forms_count} forms.
                    </strong>{' '}
                    {canMaster
                      ? 'Saving updates all linked master forms unless you detach below.'
                      : 'Workspace edits automatically detach a tenant-owned copy so global master templates stay untouched.'}
                  </div>
                  {canMaster && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={detach} onChange={e => setDetach(e.target.checked)} />
                      <span>Detach from shared library for {form.code} only</span>
                    </label>
                  )}
                </div>
              )}

              <label className="field">
                <span>Item / Policy Requirement Prompt</span>
                <textarea
                  className="input"
                  rows={3}
                  value={qText}
                  onChange={e => setQText(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </label>

              <label className="field">
                <span>
                  {maturity
                    ? 'Development step'
                    : scale === 'policy_gap'
                    ? 'Remediation Action Plan Wording (when Partially Covered or Not Addressed)'
                    : 'Default Recommendation Text'}
                </span>
                <textarea
                  className="input"
                  rows={3}
                  value={qRec}
                  onChange={e => setQRec(e.target.value)}
                  style={{ width: '100%' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
                <label className="field">
                  <span>Priority</span>
                  <select className="select" value={qPriority} onChange={e => setQPriority(e.target.value)}>
                    <option value="High">High (7 days)</option>
                    <option value="Med">Med (30 days)</option>
                    <option value="Low">Low (60 days)</option>
                  </select>
                </label>
                <label className="field">
                  <span>Hazard / Regulation Topic Key</span>
                  <input className="input" value={qTopic} onChange={e => setQTopic(e.target.value)} required />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>{scale === 'lce_100' ? 'Max Points for Item' : 'Measurement Threshold'}</span>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    value={qThreshold}
                    onChange={e => setQThreshold(e.target.value)}
                    placeholder={scale === 'lce_100' ? '10' : '36'}
                  />
                </label>
                <label className="field">
                  <span>Comparison</span>
                  <select className="select" value={qComp} onChange={e => setQComp(e.target.value)}>
                    <option value="min">≥ Minimum</option>
                    <option value="max">≤ Maximum / Max Pts</option>
                    <option value="exact">= Exact</option>
                  </select>
                </label>
                <label className="field">
                  <span>Unit</span>
                  <input
                    className="input"
                    value={qUnit}
                    onChange={e => setQUnit(e.target.value)}
                    placeholder={scale === 'lce_100' ? 'pts' : 'in / ft / °F'}
                  />
                </label>
              </div>

              {(!open.question_key?.startsWith('SHR-') || canMaster) && (
                <div className="frame" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="kicker">Link Official Regulation Citation (Jurisdiction Mapping)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8 }}>
                    <input
                      className="input mono"
                      value={linkJur}
                      onChange={e => setLinkJur(e.target.value.toUpperCase())}
                      placeholder="CA / FED"
                    />
                    <select className="select" value={linkRegId} onChange={e => setLinkRegId(e.target.value)}>
                      <option value="">— Keep Current Citations —</option>
                      {regs.map(r => (
                        <option key={r.reg_id} value={r.reg_id}>
                          {r.jurisdiction} · {r.code} — {r.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <label className="field">
                <span>Custom N/A label (optional)</span>
                <input className="input" value={qNa} onChange={e => setQNa(e.target.value)} />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={qPhoto} onChange={e => setQPhoto(e.target.checked)} />
                <span>Require photo evidence when deficient</span>
              </label>

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    Save Item
                  </button>
                  <button type="button" className="btn" onClick={() => setOpen(null)}>
                    Cancel
                  </button>
                </div>
                <button
                  type="button"
                  className="btn"
                  style={{ color: 'var(--bad)' }}
                  disabled={busy}
                  onClick={() => deleteQuestion(open.question_id)}
                >
                  Delete Unused Item
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* CREATE QUESTION DRAWER */}
      {creating && (
        <>
          <div className="drawer-bg" onClick={() => setCreating(false)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 620, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">
                  {form.code} · Section {current.section_no} · {current.name}
                </div>
                <h2>Add Item / Policy Requirement</h2>
              </div>
              <button
                className="btn"
                style={{ width: 36, height: 36, padding: 0 }}
                onClick={() => setCreating(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={createQuestion} className="drawer-body">
              <label className="field">
                <span>Item / Policy Requirement Prompt</span>
                <textarea
                  className="input"
                  rows={3}
                  value={qText}
                  onChange={e => setQText(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </label>
              <label className="field">
                <span>Default Recommendation / Remediation Wording</span>
                <textarea
                  className="input"
                  rows={3}
                  value={qRec}
                  onChange={e => setQRec(e.target.value)}
                  style={{ width: '100%' }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px', gap: 10 }}>
                <label className="field">
                  <span>Priority</span>
                  <select className="select" value={qPriority} onChange={e => setQPriority(e.target.value)}>
                    <option value="High">High (7d)</option>
                    <option value="Med">Med (30d)</option>
                    <option value="Low">Low (60d)</option>
                  </select>
                </label>
                <label className="field">
                  <span>Topic Key</span>
                  <input className="input" value={qTopic} onChange={e => setQTopic(e.target.value)} required />
                </label>
                <label className="field">
                  <span>{scale === 'lce_100' ? 'Max Points' : 'Threshold'}</span>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    value={qThreshold}
                    onChange={e => setQThreshold(e.target.value)}
                  />
                </label>
              </div>

              <div className="frame" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="kicker">Primary Regulation Citation (Optional)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 8 }}>
                  <input
                    className="input mono"
                    value={linkJur}
                    onChange={e => setLinkJur(e.target.value.toUpperCase())}
                    placeholder="CA"
                  />
                  <select className="select" value={linkRegId} onChange={e => setLinkRegId(e.target.value)}>
                    <option value="">— Optional Citation —</option>
                    {regs.map(r => (
                      <option key={r.reg_id} value={r.reg_id}>
                        {r.jurisdiction} · {r.code} — {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={qPhoto} onChange={e => setQPhoto(e.target.checked)} />
                <span>Require photo when deficient</span>
              </label>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Add Item
                </button>
                <button type="button" className="btn" onClick={() => setCreating(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* FORM / POLICY SETTINGS DRAWER */}
      {showFormSettings && (
        <>
          <div className="drawer-bg" onClick={() => setShowFormSettings(false)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 600, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">
                  {form.code} · {form.tenant_id ? 'Workspace Custom' : 'Master Library'} Settings
                </div>
                <h2>Edit Form / Written Policy Settings</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setShowFormSettings(false)}>
                ×
              </button>
            </div>
            <form
              className="drawer-body"
              onSubmit={e => {
                e.preventDefault();
                const chosenLine = industries.find((l: any) => l.code === fShieldCode);
                postFormAction(
                  {
                    action: 'update_form',
                    name: fName,
                    category: fCategory,
                    scale: fScale,
                    industry: chosenLine?.name || form.industry || 'General',
                    shieldCode: fShieldCode || null,
                    subsectorCode: fSubsector || null,
                    description: fDesc,
                    allowAdditionalFindings: fAllowAdditional,
                  },
                  () => setShowFormSettings(false)
                );
              }}
            >
              <label className="field">
                <span>Form / Policy Title</span>
                <input className="input" value={fName} onChange={e => setFName(e.target.value)} required />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Template Category</span>
                  <select className="select" value={fCategory} onChange={e => setFCategory(e.target.value)}>
                    <option value="field_inspection">Field Inspection Checklist</option>
                    <option value="policy_gap">Written Policy Gap Analysis (GAP-*)</option>
                    <option value="lce_100">100-Point Loss Control Evaluation (LCE)</option>
                    <option value="auto_sup_1_5">1–5 Auto / Fleet Supplement</option>
                    <option value="rca_percent">RCA Jobsite Compliance % Audit</option>
                    <option value="maturity">Safety Culture Maturity Assessment</option>
                  </select>
                </label>
                <label className="field">
                  <span>Scoring Scale {Number(form.inspection_count || 0) > 0 ? '(Locked by inspections)' : ''}</span>
                  <select
                    className="select"
                    value={fScale}
                    disabled={Number(form.inspection_count || 0) > 0}
                    onChange={e => setFScale(e.target.value)}
                  >
                    {Object.entries(SCALE_DESCRIPTIONS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Shield / Industry Line</span>
                  <select
                    className="select"
                    value={fShieldCode}
                    onChange={e => {
                      setFShieldCode(e.target.value);
                      setFSubsector('');
                    }}
                  >
                    <option value="">— Custom / General ({form.industry}) —</option>
                    {industries.map((l: any) => (
                      <option key={l.code} value={l.code}>
                        {l.shield_brand ? `${l.shield_brand} — ${l.name}` : l.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Sub-Sector (Optional)</span>
                  <select className="select" value={fSubsector} onChange={e => setFSubsector(e.target.value)}>
                    <option value="">— All Sub-Sectors —</option>
                    {(industries.find((l: any) => l.code === fShieldCode)?.subsectors || []).map((sub: any) => (
                      <option key={sub.code} value={sub.code}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                <span>Scope &amp; Regulatory Basis Description</span>
                <textarea className="input" rows={3} value={fDesc} onChange={e => setFDesc(e.target.value)} />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={fAllowAdditional}
                  onChange={e => setFAllowAdditional(e.target.checked)}
                />
                <span>Allow consultants to log ad-hoc Additional Site Findings during inspections</span>
              </label>

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Save Form Settings
                </button>
                <button type="button" className="btn" onClick={() => setShowFormSettings(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* CLONE THIS TEMPLATE DRAWER */}
      {showCloneModal && (
        <>
          <div className="drawer-bg" onClick={() => setShowCloneModal(false)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 540, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Duplicate {form.code}</div>
                <h2>Clone {form.name}</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setShowCloneModal(false)}>
                ×
              </button>
            </div>
            <form
              className="drawer-body"
              onSubmit={async e => {
                e.preventDefault();
                setBusy(true);
                const res = await fetch('/api/platform', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    action: 'clone_form',
                    scope: clScope,
                    sourceCode: form.code,
                    newCode: clCode,
                    newName: clName,
                  }),
                });
                const body = await res.json();
                setBusy(false);
                notify(res.ok ? body.message : body.error);
                if (res.ok) {
                  setShowCloneModal(false);
                  router.push(`/forms/${body.code}`);
                  router.refresh();
                }
              }}
            >
              {canMaster && hasTeamWorkspace && canTenant && (
                <label className="field">
                  <span>Destination Library Plane</span>
                  <select className="select" value={clScope} onChange={e => setClScope(e.target.value as 'tenant' | 'platform')}>
                    <option value="tenant">Workspace Custom Copy (This Tenant Only)</option>
                    <option value="platform">Platform Master Template (Global Library)</option>
                  </select>
                </label>
              )}
              <label className="field">
                <span>New Template Code (up to 16 chars)</span>
                <input
                  className="input mono"
                  value={clCode}
                  onChange={e => setClCode(e.target.value.toUpperCase())}
                  required
                />
              </label>
              <label className="field">
                <span>New Form / Policy Title</span>
                <input className="input" value={clName} onChange={e => setClName(e.target.value)} required />
              </label>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Clone &amp; Open Builder →
                </button>
                <button type="button" className="btn" onClick={() => setShowCloneModal(false)}>
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
