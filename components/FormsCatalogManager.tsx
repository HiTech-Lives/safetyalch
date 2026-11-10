'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from './ui';

const SCALE_LABELS: Record<string, string> = {
  safe_unsafe_na: 'Safe · Unsafe · N/A',
  maturity: 'Maturity (Absent → Owned)',
  policy_gap: 'Policy Gap (Addressed / Partial / Not Addressed)',
  lce_100: '100-Pt LCE Scorecard',
  auto_sup_1_5: '1–5 Fleet Supplement',
  rca_percent: 'RCA % Compliance',
};

const CATEGORY_BADGES: Record<string, string> = {
  field_inspection: 'Field Checklist',
  policy_gap: 'Written Policy Gap',
  lce_100: 'Captive 100-Pt LCE',
  auto_sup_1_5: 'Auto Supplement',
  rca_percent: 'RCA Jobsite Audit',
  maturity: 'Culture Maturity',
};

export default function FormsCatalogManager({
  forms,
  bookRecommendations,
  industries,
  regs,
  canMaster,
  canTenant,
  hasTeamWorkspace,
}: {
  forms: any[];
  bookRecommendations: any[];
  industries: any[];
  regs: any[];
  canMaster: boolean;
  canTenant: boolean;
  hasTeamWorkspace: boolean;
}) {
  const router = useRouter();
  const canCreateAny = canMaster || canTenant;

  const [tab, setTab] = useState<'all' | 'field' | 'policy' | 'scorecards' | 'maturity' | 'archived' | 'book'>('all');
  const [search, setSearch] = useState('');
  const [creatingForm, setCreatingForm] = useState(false);
  const [editingForm, setEditingForm] = useState<any | null>(null);
  const [cloningForm, setCloningForm] = useState<any | null>(null);
  const [editingBook, setEditingBook] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // New Form / Written Policy state
  const [fScope, setFScope] = useState<'tenant' | 'platform'>(hasTeamWorkspace && canTenant ? 'tenant' : 'platform');
  const [fCode, setFCode] = useState('');
  const [fName, setFName] = useState('');
  const [fCategory, setFCategory] = useState('field_inspection');
  const [fScale, setFScale] = useState('safe_unsafe_na');
  const [fShieldCode, setFShieldCode] = useState(industries[0]?.code || 'AGRI');
  const [fSubsector, setFSubsector] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fSectionsText, setFSectionsText] = useState('1. Management Commitment & Written Policy\n2. Hazard Controls & Field Execution\n3. Training & Documentation');

  // Edit existing Form / Written Policy metadata state
  const [efName, setEfName] = useState('');
  const [efCategory, setEfCategory] = useState('field_inspection');
  const [efScale, setEfScale] = useState('safe_unsafe_na');
  const [efShieldCode, setEfShieldCode] = useState('');
  const [efIndustryText, setEfIndustryText] = useState('');
  const [efSubsector, setEfSubsector] = useState('');
  const [efDesc, setEfDesc] = useState('');
  const [efAllowAdditional, setEfAllowAdditional] = useState(true);

  // Clone Form quick drawer state
  const [clScope, setClScope] = useState<'tenant' | 'platform'>(hasTeamWorkspace && canTenant ? 'tenant' : 'platform');
  const [clCode, setClCode] = useState('');
  const [clName, setClName] = useState('');

  // Book of Recommendations state
  const [brTitle, setBrTitle] = useState('');
  const [brBody, setBrBody] = useState('');
  const [brTrigger, setBrTrigger] = useState('Regulatory');
  const [brPrio, setBrPrio] = useState('Med');
  const [brScope, setBrScope] = useState('site_specific');
  const [brTopic, setBrTopic] = useState('general');
  const [brRegId, setBrRegId] = useState('');
  const [brLibScope, setBrLibScope] = useState<'tenant' | 'platform'>(hasTeamWorkspace && canTenant ? 'tenant' : 'platform');

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3400);
  }

  const activeFormsCount = useMemo(() => forms.filter(f => !f.is_archived).length, [forms]);
  const archivedFormsCount = useMemo(() => forms.filter(f => Boolean(f.is_archived)).length, [forms]);

  const filteredForms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return forms.filter(f => {
      const archived = Boolean(f.is_archived);
      if (tab === 'archived') {
        if (!archived) return false;
      } else {
        if (archived) return false;
        const cat = f.category || (f.scale === 'maturity' ? 'maturity' : 'field_inspection');
        if (tab === 'field' && cat !== 'field_inspection') return false;
        if (tab === 'policy' && cat !== 'policy_gap') return false;
        if (tab === 'scorecards' && !['lce_100', 'auto_sup_1_5', 'rca_percent'].includes(cat)) return false;
        if (tab === 'maturity' && cat !== 'maturity') return false;
      }
      if (q && !(f.code + ' ' + f.name + ' ' + f.industry + ' ' + (f.description || '')).toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [forms, tab, search]);

  const filteredBook = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookRecommendations.filter(b => {
      if (!q) return true;
      return (b.title + ' ' + b.body + ' ' + b.trigger_type + ' ' + (b.reg_code || '')).toLowerCase().includes(q);
    });
  }, [bookRecommendations, search]);

  function openEditFormDrawer(f: any) {
    setEditingForm(f);
    setEfName(f.name || '');
    setEfCategory(f.category || 'field_inspection');
    setEfScale(f.scale || 'safe_unsafe_na');
    setEfShieldCode(f.shield_code || '');
    setEfIndustryText(f.industry || 'General');
    setEfSubsector(f.subsector_code || '');
    setEfDesc(f.description || '');
    setEfAllowAdditional(f.allow_additional_findings !== 0);
  }

  function openCloneCardDrawer(f: any) {
    setCloningForm(f);
    setClScope(hasTeamWorkspace && canTenant ? 'tenant' : 'platform');
    setClCode(`${f.code}-COPY`.slice(0, 16));
    setClName(`${f.name} (Custom)`);
  }

  function openBookDrawer(item?: any) {
    if (item) {
      setEditingBook(item);
      setBrTitle(item.title);
      setBrBody(item.body);
      setBrTrigger(item.trigger_type || 'Regulatory');
      setBrPrio(item.priority || 'Med');
      setBrScope(item.scope || 'site_specific');
      setBrTopic(item.topic || 'general');
      setBrRegId(item.reg_id || '');
      setBrLibScope(item.tenant_id ? 'tenant' : 'platform');
    } else {
      setEditingBook({ id: null });
      setBrTitle('');
      setBrBody('');
      setBrTrigger('Regulatory');
      setBrPrio('Med');
      setBrScope('site_specific');
      setBrTopic('general');
      setBrRegId('');
      setBrLibScope(hasTeamWorkspace && canTenant ? 'tenant' : 'platform');
    }
  }

  async function submitCreateForm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const chosenLine = industries.find(l => l.code === fShieldCode);
    const parsedSections = fSectionsText
      .split(/\r?\n/)
      .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(Boolean)
      .map(s => {
        const ptsMatch = s.match(/\[(\d+)\s*pts?\]$/i);
        if (ptsMatch) {
          return { name: s.replace(/\[(\d+)\s*pts?\]$/i, '').trim(), maxPoints: Number(ptsMatch[1]) };
        }
        return { name: s };
      });

    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create_form',
        scope: fScope,
        code: fCode,
        name: fName,
        category: fCategory,
        scale: fScale,
        industry: chosenLine?.name || 'General',
        shieldCode: fShieldCode || null,
        subsectorCode: fSubsector || null,
        description: fDesc,
        sections: parsedSections,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setCreatingForm(false);
      router.push(`/forms/${body.code}`);
      router.refresh();
    }
  }

  async function submitEditForm(e: React.FormEvent) {
    e.preventDefault();
    if (!editingForm) return;
    setBusy(true);
    const chosenLine = industries.find(l => l.code === efShieldCode);
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update_form',
        formCode: editingForm.code,
        name: efName,
        category: efCategory,
        scale: efScale,
        industry: chosenLine?.name || efIndustryText || 'General',
        shieldCode: efShieldCode || null,
        subsectorCode: efSubsector || null,
        description: efDesc,
        allowAdditionalFindings: efAllowAdditional,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setEditingForm(null);
      router.refresh();
    }
  }

  async function submitCloneCard(e: React.FormEvent) {
    e.preventDefault();
    if (!cloningForm) return;
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'clone_form',
        scope: clScope,
        sourceCode: cloningForm.code,
        newCode: clCode,
        newName: clName,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setCloningForm(null);
      router.push(`/forms/${body.code}`);
      router.refresh();
    }
  }

  async function toggleArchiveForm(f: any, restore = false) {
    const label = restore ? 'Restore' : 'Archive';
    if (!restore && !window.confirm(`Archive template "${f.code} · ${f.name}"? You can restore it anytime from the Archived tab.`)) {
      return;
    }
    setBusy(true);
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: restore ? 'restore_form' : 'archive_form',
        formCode: f.code,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error || `${label} failed.`);
    if (res.ok) router.refresh();
  }

  async function permanentlyDeleteForm(f: any) {
    if (!window.confirm(`Permanently delete unused template "${f.code} · ${f.name}" and all ${f.n} items? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete_form', formCode: f.code }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) router.refresh();
  }

  async function submitBookRec(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/book-recommendations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        id: editingBook?.id || undefined,
        libraryScope: brLibScope,
        title: brTitle,
        body: brBody,
        triggerType: brTrigger,
        priority: brPrio,
        scope: brScope,
        topic: brTopic,
        regId: brRegId || null,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setEditingBook(null);
      router.refresh();
    }
  }

  async function archiveBookRec(id: string) {
    setBusy(true);
    const res = await fetch('/api/book-recommendations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'archive', id }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) router.refresh();
  }

  const chosenIndLine = industries.find(l => l.code === fShieldCode);
  const editIndLine = industries.find(l => l.code === efShieldCode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="tabs">
          <button type="button" className={'tab ' + (tab === 'all' ? 'on' : '')} onClick={() => setTab('all')}>
            All Active ({activeFormsCount})
          </button>
          <button type="button" className={'tab ' + (tab === 'field' ? 'on' : '')} onClick={() => setTab('field')}>
            Field Checklists
          </button>
          <button type="button" className={'tab ' + (tab === 'policy' ? 'on' : '')} onClick={() => setTab('policy')}>
            Written Policy Gaps
          </button>
          <button type="button" className={'tab ' + (tab === 'scorecards' ? 'on' : '')} onClick={() => setTab('scorecards')}>
            Captive Scorecards (LCE · Auto · RCA)
          </button>
          <button type="button" className={'tab ' + (tab === 'maturity' ? 'on' : '')} onClick={() => setTab('maturity')}>
            Culture Maturity
          </button>
          <button type="button" className={'tab ' + (tab === 'book' ? 'on' : '')} onClick={() => setTab('book')}>
            Book of Recommendations ({bookRecommendations.length})
          </button>
          {canCreateAny && (
            <button type="button" className={'tab ' + (tab === 'archived' ? 'on' : '')} onClick={() => setTab('archived')}>
              Archived ({archivedFormsCount})
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'book' ? 'Search Book of Recs…' : 'Search code, policy, or industry…'}
            style={{ width: 230 }}
          />
          {canCreateAny && tab !== 'book' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreatingForm(true)}>
              + New Form / Written Policy
            </button>
          )}
          {canCreateAny && tab === 'book' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openBookDrawer()}>
              + Add Book Recommendation
            </button>
          )}
        </div>
      </div>

      {!canCreateAny && (
        <div className="banner dashed">
          Read-only view: sign in with Master Compliance (`platform:forms.master_manage`) or Workspace Form Admin (`team:forms.tenant_manage`) privileges to add, edit, clone, or archive forms and policies.
        </div>
      )}

      {tab !== 'book' ? (
        <div className="cards">
          {filteredForms.map(f => {
            const cat = f.category || 'field_inspection';
            const canEditThis = f.tenant_id ? canTenant : canMaster;
            const isUnused = Number(f.inspection_count || 0) === 0 && Number(f.visit_count || 0) === 0;
            return (
              <Frame
                key={f.code}
                className="stat"
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Pill kind="solid">{f.code}</Pill>
                  <Pill kind={cat === 'policy_gap' ? 'amber' : cat === 'field_inspection' ? 'line' : 'ink'}>
                    {CATEGORY_BADGES[cat] || cat}
                  </Pill>
                  {f.tenant_id ? <Pill kind="acc">Workspace Custom</Pill> : <Pill kind="verified">Master v{f.version}</Pill>}
                  {Boolean(f.is_archived) && <Pill kind="overdue">Archived</Pill>}
                </div>

                <Link
                  href={'/forms/' + f.code}
                  style={{ font: '700 18px/1.15 var(--fh)', letterSpacing: '.02em', textTransform: 'uppercase', color: 'var(--ink)' }}
                >
                  {f.name}
                </Link>

                {f.description && (
                  <span style={{ fontSize: 12, color: 'var(--n7)', lineHeight: 1.4 }}>{f.description}</span>
                )}

                <span style={{ fontSize: 12, color: 'var(--n6)', marginTop: 'auto' }}>
                  {f.industry} · {f.n} items · {f.sections} sections
                  {Number(f.shared) ? ` · ${f.shared} shared` : ''}
                  {Number(f.inspection_count || 0) > 0 ? ` · ${f.inspection_count} inspections` : ''}
                </span>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--acc)' }}>
                  Scale: {SCALE_LABELS[f.scale] || f.scale}
                </span>

                <div
                  style={{
                    borderTop: '1px solid var(--div2)',
                    paddingTop: 10,
                    marginTop: 4,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <Link href={'/forms/' + f.code} className="btn btn-primary btn-sm">
                    {canEditThis ? 'Edit Items & Sections →' : 'View Template →'}
                  </Link>
                  {canEditThis && (
                    <button type="button" className="btn btn-sm" onClick={() => openEditFormDrawer(f)}>
                      Settings
                    </button>
                  )}
                  {canCreateAny && (
                    <button type="button" className="btn btn-sm" onClick={() => openCloneCardDrawer(f)}>
                      Clone
                    </button>
                  )}
                  {canEditThis && !f.is_archived && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() => toggleArchiveForm(f, false)}
                    >
                      Archive
                    </button>
                  )}
                  {canEditThis && Boolean(f.is_archived) && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() => toggleArchiveForm(f, true)}
                    >
                      Restore
                    </button>
                  )}
                  {canEditThis && isUnused && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ color: 'var(--bad)' }}
                      disabled={busy}
                      onClick={() => permanentlyDeleteForm(f)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </Frame>
            );
          })}
          {filteredForms.length === 0 && (
            <Frame style={{ padding: 20, fontSize: 13, color: 'var(--n6)' }}>
              {tab === 'archived'
                ? 'No archived templates.'
                : 'No forms or written policies match the current filter.'}
            </Frame>
          )}
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 920 }}>
            <thead>
              <tr>
                <th>Title &amp; Standard Wording</th>
                <th>Trigger</th>
                <th>Priority</th>
                <th>Scope</th>
                <th>Citation</th>
                <th>Library</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredBook.map(b => {
                const canEditThis = b.tenant_id ? canTenant : canMaster;
                return (
                  <tr key={b.id}>
                    <td style={{ maxWidth: 440 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{b.title}</div>
                      <div className="sub" style={{ marginTop: 3, lineHeight: 1.45 }}>
                        {b.body}
                      </div>
                    </td>
                    <td>
                      <Pill kind="ink">{b.trigger_type}</Pill>
                    </td>
                    <td>
                      <Pill kind={b.priority === 'High' ? 'overdue' : b.priority === 'Med' ? 'amber' : 'line'}>
                        {b.priority}
                      </Pill>
                    </td>
                    <td className="kicker">{b.scope === 'corporate' ? 'Corporate' : 'Site Specific'}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {b.reg_code ? `${b.reg_code} (${b.reg_jurisdiction})` : b.topic}
                    </td>
                    <td>
                      <Pill kind={b.tenant_id ? 'acc' : 'line'}>{b.tenant_id ? 'Workspace' : 'Master'}</Pill>
                    </td>
                    <td>
                      {canEditThis && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" className="btn btn-sm" onClick={() => openBookDrawer(b)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ color: 'var(--bad)' }}
                            disabled={busy}
                            onClick={() => archiveBookRec(b.id)}
                          >
                            Archive
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE NEW FORM / WRITTEN POLICY DRAWER */}
      {creatingForm && (
        <>
          <div className="drawer-bg" onClick={() => setCreatingForm(false)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 640, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">One-Stop Form, Written Policy &amp; Scorecard Builder</div>
                <h2>Create New Form or Written Policy</h2>
              </div>
              <button
                className="btn"
                style={{ width: 36, height: 36, padding: 0 }}
                onClick={() => setCreatingForm(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={submitCreateForm} className="drawer-body">
              {canMaster && hasTeamWorkspace && canTenant && (
                <label className="field">
                  <span>Library Ownership Plane</span>
                  <select className="select" value={fScope} onChange={e => setFScope(e.target.value as any)}>
                    <option value="tenant">Workspace Custom Template (This Tenant Only)</option>
                    <option value="platform">Platform Master Template (Global Library)</option>
                  </select>
                </label>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10 }}>
                <label className="field">
                  <span>Template Code</span>
                  <input
                    className="input mono"
                    value={fCode}
                    onChange={e => setFCode(e.target.value.toUpperCase())}
                    placeholder="GAP-WVPP"
                    required
                  />
                </label>
                <label className="field">
                  <span>Form / Policy Title</span>
                  <input
                    className="input"
                    value={fName}
                    onChange={e => setFName(e.target.value)}
                    placeholder="CA SB 553 Workplace Violence Prevention Policy Gap Analysis"
                    required
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Template Category</span>
                  <select
                    className="select"
                    value={fCategory}
                    onChange={e => {
                      const c = e.target.value;
                      setFCategory(c);
                      if (c === 'policy_gap') setFScale('policy_gap');
                      else if (c === 'lce_100') setFScale('lce_100');
                      else if (c === 'auto_sup_1_5') setFScale('auto_sup_1_5');
                      else if (c === 'rca_percent') setFScale('rca_percent');
                      else if (c === 'maturity') setFScale('maturity');
                      else setFScale('safe_unsafe_na');
                    }}
                  >
                    <option value="field_inspection">Field Inspection Checklist</option>
                    <option value="policy_gap">Written Policy Gap Analysis (GAP-*)</option>
                    <option value="lce_100">100-Point Loss Control Evaluation (LCE)</option>
                    <option value="auto_sup_1_5">1–5 Auto / Fleet Supplement</option>
                    <option value="rca_percent">RCA Jobsite Compliance % Audit</option>
                    <option value="maturity">Safety Culture Maturity Assessment</option>
                  </select>
                </label>

                <label className="field">
                  <span>Scoring / Response Scale</span>
                  <select className="select" value={fScale} onChange={e => setFScale(e.target.value)}>
                    {Object.entries(SCALE_LABELS).map(([k, lbl]) => (
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
                    {industries.map(l => (
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
                    {(chosenIndLine?.subsectors || []).map((sub: any) => (
                      <option key={sub.code} value={sub.code}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                <span>Scope &amp; Regulatory Basis Description</span>
                <textarea
                  className="input"
                  rows={2}
                  value={fDesc}
                  onChange={e => setFDesc(e.target.value)}
                  placeholder="Evaluates written policy elements against Cal/OSHA 8 CCR §3342..."
                />
              </label>

              <label className="field">
                <span>
                  Starter Sections (one per line · for 100-Pt LCE append <code>[25 pts]</code>)
                </span>
                <textarea
                  className="input mono"
                  rows={4}
                  value={fSectionsText}
                  onChange={e => setFSectionsText(e.target.value)}
                />
              </label>

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Create Template &amp; Open Builder →
                </button>
                <button type="button" className="btn" onClick={() => setCreatingForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* EDIT EXISTING FORM / WRITTEN POLICY METADATA DRAWER */}
      {editingForm && (
        <>
          <div className="drawer-bg" onClick={() => setEditingForm(null)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 620, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">
                  {editingForm.code} · {editingForm.tenant_id ? 'Workspace Template' : 'Master Library Template'}
                </div>
                <h2>Edit Form / Policy Settings</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setEditingForm(null)}>
                ×
              </button>
            </div>
            <form onSubmit={submitEditForm} className="drawer-body">
              <label className="field">
                <span>Form / Policy Title</span>
                <input className="input" value={efName} onChange={e => setEfName(e.target.value)} required />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Template Category</span>
                  <select className="select" value={efCategory} onChange={e => setEfCategory(e.target.value)}>
                    <option value="field_inspection">Field Inspection Checklist</option>
                    <option value="policy_gap">Written Policy Gap Analysis (GAP-*)</option>
                    <option value="lce_100">100-Point Loss Control Evaluation (LCE)</option>
                    <option value="auto_sup_1_5">1–5 Auto / Fleet Supplement</option>
                    <option value="rca_percent">RCA Jobsite Compliance % Audit</option>
                    <option value="maturity">Safety Culture Maturity Assessment</option>
                  </select>
                </label>

                <label className="field">
                  <span>Scoring Scale {Number(editingForm.inspection_count || 0) > 0 ? '(Locked by inspections)' : ''}</span>
                  <select
                    className="select"
                    value={efScale}
                    disabled={Number(editingForm.inspection_count || 0) > 0}
                    onChange={e => setEfScale(e.target.value)}
                  >
                    {Object.entries(SCALE_LABELS).map(([k, lbl]) => (
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
                    value={efShieldCode}
                    onChange={e => {
                      setEfShieldCode(e.target.value);
                      setEfSubsector('');
                    }}
                  >
                    <option value="">— Custom / General ({efIndustryText}) —</option>
                    {industries.map(l => (
                      <option key={l.code} value={l.code}>
                        {l.shield_brand ? `${l.shield_brand} — ${l.name}` : l.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Sub-Sector (Optional)</span>
                  <select className="select" value={efSubsector} onChange={e => setEfSubsector(e.target.value)}>
                    <option value="">— All Sub-Sectors —</option>
                    {(editIndLine?.subsectors || []).map((sub: any) => (
                      <option key={sub.code} value={sub.code}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                <span>Scope &amp; Regulatory Basis Description</span>
                <textarea
                  className="input"
                  rows={3}
                  value={efDesc}
                  onChange={e => setEfDesc(e.target.value)}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={efAllowAdditional}
                  onChange={e => setEfAllowAdditional(e.target.checked)}
                />
                <span>Allow consultants to log ad-hoc Additional Site Findings during inspections</span>
              </label>

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    Save Settings
                  </button>
                  <button type="button" className="btn" onClick={() => setEditingForm(null)}>
                    Cancel
                  </button>
                </div>
                <Link href={`/forms/${editingForm.code}`} className="btn">
                  Open Item Builder →
                </Link>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* QUICK CLONE FROM CARD DRAWER */}
      {cloningForm && (
        <>
          <div className="drawer-bg" onClick={() => setCloningForm(null)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 540, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Duplicate {cloningForm.code} ({cloningForm.n} items)</div>
                <h2>Clone {cloningForm.name}</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setCloningForm(null)}>
                ×
              </button>
            </div>
            <form onSubmit={submitCloneCard} className="drawer-body">
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
                <input
                  className="input"
                  value={clName}
                  onChange={e => setClName(e.target.value)}
                  required
                />
              </label>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Clone &amp; Open Builder →
                </button>
                <button type="button" className="btn" onClick={() => setCloningForm(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* BOOK OF RECOMMENDATIONS DRAWER */}
      {editingBook && (
        <>
          <div className="drawer-bg" onClick={() => setEditingBook(null)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 620, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Standardized Book of Recommendations</div>
                <h2>{editingBook.id ? 'Edit Standard Recommendation' : 'New Book of Recommendations Entry'}</h2>
              </div>
              <button
                className="btn"
                style={{ width: 36, height: 36, padding: 0 }}
                onClick={() => setEditingBook(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={submitBookRec} className="drawer-body">
              {!editingBook.id && canMaster && hasTeamWorkspace && canTenant && (
                <label className="field">
                  <span>Library Scope</span>
                  <select className="select" value={brLibScope} onChange={e => setBrLibScope(e.target.value as any)}>
                    <option value="tenant">Workspace Library (This Tenant)</option>
                    <option value="platform">Platform Master Library (All Tenants)</option>
                  </select>
                </label>
              )}

              <label className="field">
                <span>Recommendation Title (prints as bold header on ARU letters &amp; response forms)</span>
                <input
                  className="input"
                  value={brTitle}
                  onChange={e => setBrTitle(e.target.value)}
                  required
                  placeholder="Update Written Heat Illness Prevention Plan (HIPP) High-Heat Procedures"
                />
              </label>

              <label className="field">
                <span>Standardized Corrective Action Wording</span>
                <textarea
                  className="input"
                  rows={4}
                  value={brBody}
                  onChange={e => setBrBody(e.target.value)}
                  required
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Trigger Type</span>
                  <select className="select" value={brTrigger} onChange={e => setBrTrigger(e.target.value)}>
                    {['Regulatory', 'Best Practice', 'Program', 'Training', 'Maintenance', 'Record Keeping'].map(tr => (
                      <option key={tr} value={tr}>
                        {tr}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Default Priority</span>
                  <select className="select" value={brPrio} onChange={e => setBrPrio(e.target.value)}>
                    <option value="High">High (7 days)</option>
                    <option value="Med">Med (30 days)</option>
                    <option value="Low">Low (60 days)</option>
                  </select>
                </label>
                <label className="field">
                  <span>Recommendation Scope</span>
                  <select className="select" value={brScope} onChange={e => setBrScope(e.target.value)}>
                    <option value="site_specific">Site Specific</option>
                    <option value="corporate">Corporate-Wide</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 10 }}>
                <label className="field">
                  <span>Hazard Topic Key</span>
                  <input className="input" value={brTopic} onChange={e => setBrTopic(e.target.value)} />
                </label>
                <label className="field">
                  <span>Linked Regulation Citation (Resource Standard URL)</span>
                  <select className="select" value={brRegId} onChange={e => setBrRegId(e.target.value)}>
                    <option value="">— Optional Citation Link —</option>
                    {regs.map(r => (
                      <option key={r.reg_id} value={r.reg_id}>
                        {r.jurisdiction} · {r.code} — {r.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Save Book Entry
                </button>
                <button type="button" className="btn" onClick={() => setEditingBook(null)}>
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
