'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from './ui';
import { fmtDate } from '@/lib/format';

const unverified = (g: any) => !g.verified_on || String(g.status).startsWith('UNVERIFIED');

function daysSince(dateVal?: string | Date | null): number | null {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export default function RegTable({
  regs,
  portals,
  industries,
  canGlobal,
  canSupplemental,
  hasTeamWorkspace,
}: {
  regs: any[];
  portals: any[];
  industries: any[];
  canGlobal: boolean;
  canSupplemental: boolean;
  hasTeamWorkspace: boolean;
}) {
  const router = useRouter();
  const canEditAny = canGlobal || canSupplemental;

  const [tab, setTab] = useState<'portals' | 'shields' | 'citations'>('portals');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Tab 1: 56-Jurisdiction & Master Repo Filters + Live Fetch Drawer
  const [planFilter, setPlanFilter] = useState<string>('ALL');
  const [portalSearch, setPortalSearch] = useState('');
  const [liveResult, setLiveResult] = useState<{
    title: string;
    finalUrl: string;
    status: number;
    checkedAt: string;
    lastModified: string | null;
    excerpt: string;
  } | null>(null);
  const [fetchingKey, setFetchingKey] = useState<string | null>(null);
  const [editingPortal, setEditingPortal] = useState<any | null>(null);
  const [epAgency, setEpAgency] = useState('');
  const [epAdminCode, setEpAdminCode] = useState('');
  const [epPortalUrl, setEpPortalUrl] = useState('');
  const [epStandardsUrl, setEpStandardsUrl] = useState('');
  const [epDivergence, setEpDivergence] = useState('');

  // Tab 3: Citations Library State
  const [j, setJ] = useState('All');
  const [t, setT] = useState('All');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'GLOBAL' | 'WORKSPACE' | 'DUE_90'>('ALL');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [superseding, setSuperseding] = useState(false);

  // Verify / Supersede state
  const [vText, setVText] = useState('');
  const [vSource, setVSource] = useState('');
  const [vNotes, setVNotes] = useState('');
  const [sCode, setSCode] = useState('');
  const [sTitle, setSTitle] = useState('');
  const [sSummary, setSSummary] = useState('');

  // Create state
  const [cScope, setCScope] = useState<'tenant' | 'global'>(hasTeamWorkspace && canSupplemental ? 'tenant' : 'global');
  const [cJur, setCJur] = useState('CA');
  const [cAgency, setCAgency] = useState('Cal/OSHA');
  const [cCode, setCCode] = useState('');
  const [cTitle, setCTitle] = useState('');
  const [cTopic, setCTopic] = useState('heat_illness');
  const [cSummary, setCSummary] = useState('');
  const [cVerbatim, setCVerbatim] = useState('');
  const [cSource, setCSource] = useState('https://www.dir.ca.gov/title8/3395.html');
  const [cNotes, setCNotes] = useState('');
  const [cVerifyNow, setCVerifyNow] = useState(false);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  const filteredPortals = useMemo(() => {
    const needle = portalSearch.trim().toLowerCase();
    return portals.filter(p => {
      if (planFilter === 'BIG4' && !p.diverges_from_fed && !['CA', 'WA', 'OR', 'MI'].includes(p.code)) return false;
      else if (planFilter !== 'ALL' && planFilter !== 'BIG4' && p.plan_type !== planFilter) return false;
      if (needle) {
        const hay = `${p.code} ${p.name} ${p.agency} ${p.divergence_summary || ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [portals, planFilter, portalSearch]);

  const dueQuarterlyCount = useMemo(
    () =>
      regs.filter(g => {
        if (g.status === 'superseded') return false;
        if (unverified(g)) return true;
        const age = daysSince(g.last_live_checked_at || g.verified_on);
        return age === null || age > 90;
      }).length,
    [regs]
  );

  const js = ['All', ...Array.from(new Set(regs.map(g => g.jurisdiction)))];
  const ts = ['All', ...Array.from(new Set(regs.map(g => g.topic))).sort()];

  const rows = useMemo(
    () =>
      regs.filter(g => {
        if (j !== 'All' && g.jurisdiction !== j) return false;
        if (t !== 'All' && g.topic !== t) return false;
        if (scopeFilter === 'GLOBAL' && g.tenant_id !== null) return false;
        if (scopeFilter === 'WORKSPACE' && g.tenant_id === null) return false;
        if (scopeFilter === 'DUE_90') {
          const age = daysSince(g.last_live_checked_at || g.verified_on);
          if (g.status === 'superseded' || (!unverified(g) && age !== null && age <= 90)) return false;
        }
        if (q && !(g.code + ' ' + g.title + ' ' + g.summary).toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [regs, j, t, scopeFilter, q]
  );

  async function runLiveFetch(opts: { url?: string; portalCode?: string; regId?: string; intoField?: 'verify' | 'create' }) {
    const key = opts.portalCode || opts.regId || opts.url || 'fetch';
    setFetchingKey(key);
    const res = await fetch('/api/regulations/live-fetch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: opts.url,
        portalCode: opts.portalCode,
        regId: opts.regId,
      }),
    });
    const data = await res.json();
    setFetchingKey(null);
    if (!res.ok) {
      notify(data.error || 'Live regulatory fetch failed.');
      return;
    }

    if (opts.intoField === 'verify') {
      setVText(data.excerpt ? data.excerpt.slice(0, 1800) : '');
      notify(`Fetched live statutory text (HTTP ${data.status}) from ${data.finalUrl}`);
    } else if (opts.intoField === 'create') {
      setCVerbatim(data.excerpt ? data.excerpt.slice(0, 1800) : '');
      if (!cTitle && data.title) setCTitle(data.title.slice(0, 180));
      notify(`Fetched live statutory text (HTTP ${data.status})`);
    } else {
      setLiveResult(data);
    }
    router.refresh();
  }

  function selectReg(g: any) {
    setOpen(g);
    setSuperseding(false);
    setVText(g.verbatim_text ?? '');
    setVSource(g.source_url ?? '');
    setVNotes(g.notes ?? '');
    setSCode(g.code);
    setSTitle(g.title);
    setSSummary(g.summary);
  }

  const canModifyOpen = open ? (open.tenant_id === null ? canGlobal : canSupplemental) : false;

  async function verifyReg(e: React.FormEvent) {
    e.preventDefault();
    if (!open) return;
    setBusy(true);
    const res = await fetch('/api/regulations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'verify',
        regId: open.reg_id,
        verbatimText: vText,
        sourceUrl: vSource,
        notes: vNotes,
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

  async function supersedeReg(e: React.FormEvent) {
    e.preventDefault();
    if (!open) return;
    setBusy(true);
    const res = await fetch('/api/regulations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'supersede',
        oldRegId: open.reg_id,
        code: sCode,
        title: sTitle,
        summary: sSummary,
        verbatimText: vText,
        sourceUrl: vSource,
        notes: vNotes,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setOpen(null);
      setSuperseding(false);
      router.refresh();
    }
  }

  async function createReg(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/regulations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        scope: cScope,
        jurisdiction: cJur,
        agency: cAgency,
        code: cCode,
        title: cTitle,
        topic: cTopic,
        summary: cSummary,
        verbatimText: cVerbatim,
        sourceUrl: cSource,
        notes: cNotes,
        verifyNow: cVerifyNow,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setCreating(false);
      setCCode('');
      setCTitle('');
      setCSummary('');
      setCVerbatim('');
      setCNotes('');
      router.refresh();
    }
  }

  const statePortalCodes = portals.filter(p => p.plan_type !== 'master_repo').map(p => p.code);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div className="tabs">
          <button type="button" className={'tab ' + (tab === 'portals' ? 'on' : '')} onClick={() => setTab('portals')}>
            1. 56-Jurisdiction &amp; Master Portals ({portals.length})
          </button>
          <button type="button" className={'tab ' + (tab === 'shields' ? 'on' : '')} onClick={() => setTab('shields')}>
            2. Shield &amp; Specialty Regulatory Matrix ({industries.length})
          </button>
          <button type="button" className={'tab ' + (tab === 'citations' ? 'on' : '')} onClick={() => setTab('citations')}>
            3. Citations Library ({regs.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {dueQuarterlyCount > 0 && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setTab('citations');
                setScopeFilter('DUE_90');
              }}
            >
              ⟳ Quarterly Review Queue: {dueQuarterlyCount} due / unverified
            </button>
          )}
          {canEditAny && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setTab('citations');
                setCreating(true);
              }}
            >
              + Add Regulation Citation
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: 56-JURISDICTION & MASTER REPOSITORY DIRECTORY */}
      {tab === 'portals' && (
        <>
          <Frame style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {(
              [
                ['ALL', 'All Portals (' + portals.length + ')'],
                ['master_repo', 'Master Repositories'],
                ['complete_state_plan', '22 Complete State Plans'],
                ['public_sector_state_plan', '7 Public-Sector Only'],
                ['federal_osha', '22 Fed OSHA + D.C.'],
                ['BIG4', 'Key State Divergences (CA · WA · OR · MI+)'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={'btn btn-sm ' + (planFilter === key ? 'btn-primary' : '')}
                onClick={() => setPlanFilter(key)}
              >
                {label}
              </button>
            ))}
            <input
              className="input"
              value={portalSearch}
              onChange={e => setPortalSearch(e.target.value)}
              placeholder="Search state, agency, Title 8, WAC, OAR, MIOSHA…"
              style={{ marginLeft: 'auto', minWidth: 250 }}
            />
          </Frame>

          <div className="tbl-wrap">
            <table className="tbl" style={{ minWidth: 940 }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Jurisdiction / Repository</th>
                  <th>Plan Classification</th>
                  <th>Agency &amp; Key Divergence Notes</th>
                  <th>Official Live Links</th>
                  <th>Real-Time Retrieval</th>
                </tr>
              </thead>
              <tbody>
                {filteredPortals.map(p => (
                  <tr key={p.code}>
                    <td className="code">{p.code}</td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>
                      <Pill
                        kind={
                          p.plan_type === 'complete_state_plan'
                            ? 'ink'
                            : p.plan_type === 'public_sector_state_plan'
                            ? 'amber'
                            : p.plan_type === 'master_repo' || p.plan_type === 'federal_master'
                            ? 'verified'
                            : 'line'
                        }
                      >
                        {p.plan_type.replace(/_/g, ' ')}
                      </Pill>
                    </td>
                    <td style={{ fontSize: 12.5, maxWidth: 380 }}>
                      <div style={{ fontWeight: 600 }}>{p.agency}</div>
                      {p.divergence_summary && (
                        <div className="sub" style={{ marginTop: 2, lineHeight: 1.4 }}>
                          {p.divergence_summary}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <a href={p.portal_url} target="_blank" rel="noopener noreferrer">
                          Agency Portal ↗
                        </a>
                        {p.standards_url && p.standards_url !== p.portal_url && (
                          <a href={p.standards_url} target="_blank" rel="noopener noreferrer">
                            Standards / Code Index ↗
                          </a>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={fetchingKey === p.code}
                            onClick={() => runLiveFetch({ portalCode: p.code, url: p.standards_url || p.portal_url })}
                          >
                            {fetchingKey === p.code ? 'Fetching .gov…' : '⚡ Live Fetch & Verify'}
                          </button>
                          {canGlobal && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => {
                                setEditingPortal(p);
                                setEpAgency(p.agency_name || p.agency || '');
                                setEpAdminCode(p.admin_code_citation || '');
                                setEpPortalUrl(p.portal_url || '');
                                setEpStandardsUrl(p.standards_url || '');
                                setEpDivergence(p.key_divergences || p.divergence_summary || '');
                              }}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                        {p.last_verified_at && (
                          <span className="mono" style={{ fontSize: 10.5, color: 'var(--ok)' }}>
                            HTTP {p.last_http_status || 200} · {fmtDate(p.last_verified_at)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB 2: SHIELD & SPECIALTY INDUSTRY REGULATORY MATRIX */}
      {tab === 'shields' && (
        <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
          {industries.map(ind => (
            <Frame key={ind.id} className={ind.is_core_shield ? 'strong' : ''} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="code">{ind.code}</span>
                {ind.shield_brand && <Pill kind="ink">{ind.shield_brand}</Pill>}
                <Pill kind={ind.is_core_shield ? 'verified' : 'line'}>
                  {ind.is_core_shield ? 'Core Shield Line' : 'Specialty Industry'}
                </Pill>
              </div>

              <h3 style={{ margin: 0, fontSize: 17 }}>{ind.name}</h3>

              {ind.federal_baseline && (
                <div style={{ fontSize: 12.5 }}>
                  <strong>Federal Baseline:</strong> {ind.federal_baseline}
                </div>
              )}

              {ind.state_overlay_notes && (
                <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--n7)' }}>
                  <strong>State Plan Overlays:</strong> {ind.state_overlay_notes}
                </div>
              )}

              {ind.special_rule_alert && (
                <div className="banner warn" style={{ fontSize: 12, padding: '8px 10px', margin: 0 }}>
                  ⚠ {ind.special_rule_alert}
                </div>
              )}

              {ind.subsectors?.length > 0 && (
                <div style={{ borderTop: '1px solid var(--div2)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="kicker">Sub-Sectors ({ind.subsectors.length})</div>
                  {ind.subsectors.map((sub: any) => (
                    <div key={sub.code} style={{ fontSize: 12 }}>
                      <strong className="mono">{sub.code}</strong>: {sub.name}
                      {sub.description ? <span className="sub"> — {sub.description}</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </Frame>
          ))}
        </div>
      )}

      {/* TAB 3: CITATIONS LIBRARY */}
      {tab === 'citations' && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <label className="kicker" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              Jurisdiction
              <select className="select" value={j} onChange={e => setJ(e.target.value)}>
                {js.map(o => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label className="kicker" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              Topic
              <select className="select" value={t} onChange={e => setT(e.target.value)}>
                {ts.map(o => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <select
              className="select"
              value={scopeFilter}
              onChange={e => setScopeFilter(e.target.value as any)}
            >
              <option value="ALL">All Citations (Global + Workspace)</option>
              <option value="GLOBAL">Global Master Citations Only</option>
              <option value="WORKSPACE">Workspace-Supplemental Only</option>
              <option value="DUE_90">Due for 90-Day Quarterly Check</option>
            </select>

            <label className="search">
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search code or title" />
            </label>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--n6)' }}>
              {rows.length} shown · {regs.filter(unverified).length} unverified
            </span>
            {canEditAny && (
              <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
                + Add Regulation Citation
              </button>
            )}
          </div>

          <div className="tbl-wrap">
            <table className="tbl" style={{ minWidth: 940 }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Scope</th>
                  <th>Agency</th>
                  <th>Jur.</th>
                  <th>Topic</th>
                  <th>Verified / 90-Day Check</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(g => {
                  const age = daysSince(g.last_live_checked_at || g.verified_on);
                  return (
                    <tr key={g.reg_id} className="click" onClick={() => selectReg(g)}>
                      <td className="code" style={{ whiteSpace: 'nowrap' }}>
                        {g.code}
                      </td>
                      <td>{g.title}</td>
                      <td>
                        <Pill kind={g.tenant_id ? 'acc' : 'line'}>{g.tenant_id ? 'Workspace' : 'Global'}</Pill>
                      </td>
                      <td style={{ fontSize: 12 }}>{g.agency}</td>
                      <td className="kicker" style={{ color: 'var(--ink)' }}>
                        {g.jurisdiction}
                      </td>
                      <td style={{ font: '500 10.5px var(--mono)', color: 'var(--n7)' }}>{g.topic}</td>
                      <td>
                        {g.status === 'superseded' ? (
                          <Pill kind="line">Superseded</Pill>
                        ) : unverified(g) ? (
                          <Pill kind="unverified">Unverified</Pill>
                        ) : age !== null && age > 90 ? (
                          <Pill kind="amber">Verified · {age}d ago (Review)</Pill>
                        ) : (
                          <Pill kind="verified">{fmtDate(g.verified_on)}</Pill>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* LIVE FETCH STATUTORY DRAWER */}
      {liveResult && (
        <>
          <div className="drawer-bg" onClick={() => setLiveResult(null)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 680, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Real-Time Official .gov Source Retrieval · HTTP {liveResult.status}</div>
                <h2>{liveResult.title}</h2>
              </div>
              <button
                className="btn"
                style={{ width: 36, height: 36, padding: 0 }}
                onClick={() => setLiveResult(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="drawer-body">
              <dl className="frame facts" style={{ margin: 0 }}>
                <div>
                  <dt>Final Verified URL</dt>
                  <dd>
                    <a href={liveResult.finalUrl} target="_blank" rel="noopener noreferrer">
                      {liveResult.finalUrl} ↗
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Checked At</dt>
                  <dd>{liveResult.checkedAt}</dd>
                </div>
                {liveResult.lastModified && (
                  <div>
                    <dt>Agency Last-Modified</dt>
                    <dd>{liveResult.lastModified}</dd>
                  </div>
                )}
              </dl>
              <div className="kicker">Extracted Live Statutory / Portal Text Excerpt</div>
              <pre
                className="mono"
                style={{
                  margin: 0,
                  padding: 14,
                  background: 'var(--bg-soft)',
                  border: '1px solid var(--div)',
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  maxHeight: 440,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {liveResult.excerpt || 'Portal reachable (no plain text body extracted).'}
              </pre>
            </div>
          </aside>
        </>
      )}

      {/* CITATION DETAIL / VERIFY / SUPERSEDE DRAWER */}
      {open && (
        <>
          <div className="drawer-bg" onClick={() => setOpen(null)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 640, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">
                  {open.reg_id} · {open.agency} · {open.tenant_id ? 'Workspace Supplemental' : 'Global Master'}
                </div>
                <h2>{open.code}</h2>
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
            <div className="drawer-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {open.status === 'superseded' ? (
                    <Pill kind="line">Superseded by {open.superseded_by}</Pill>
                  ) : unverified(open) ? (
                    <Pill kind="unverified">Unverified</Pill>
                  ) : (
                    <Pill kind="verified">Verified</Pill>
                  )}
                  {open.source_url && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={fetchingKey === open.reg_id}
                      onClick={() =>
                        runLiveFetch({
                          regId: open.reg_id,
                          url: open.source_url,
                          intoField: unverified(open) || superseding ? 'verify' : undefined,
                        })
                      }
                    >
                      {fetchingKey === open.reg_id ? 'Fetching .gov…' : '⚡ Live Fetch Official Source'}
                    </button>
                  )}
                </div>

                {canModifyOpen && !unverified(open) && open.status !== 'superseded' && !superseding && (
                  <button className="btn btn-sm" onClick={() => setSuperseding(true)}>
                    Supersede with new entry
                  </button>
                )}
              </div>

              <div style={{ fontSize: 14.5, lineHeight: 1.5 }}>
                <strong>{open.title}.</strong> {open.summary}
              </div>

              <dl className="frame facts" style={{ margin: 0 }}>
                {[
                  ['Jurisdiction', open.jurisdiction],
                  ['Topic', open.topic],
                  [
                    'Official Source',
                    open.source_url ? (
                      <a key="src" href={open.source_url} target="_blank" rel="noopener noreferrer">
                        {open.source_url} ↗
                      </a>
                    ) : (
                      '—'
                    ),
                  ],
                  ['Verified on', open.verified_on ? fmtDate(open.verified_on) : 'Not yet'],
                  ['Verified by', open.verified_by || '—'],
                  ['Last live check', open.last_live_checked_at ? fmtDate(open.last_live_checked_at) : 'Not checked yet'],
                  ['Superseded by', open.superseded_by || '—'],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>

              {!open.verbatim_text && (
                <div className="banner dashed">
                  Verbatim text has not been pasted from the source yet. Citations print the summary until verified.
                </div>
              )}
              {open.verbatim_text && (
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    padding: 12,
                    background: 'var(--bg-soft)',
                    border: '1px solid var(--div2)',
                  }}
                >
                  {open.verbatim_text}
                </div>
              )}

              {canModifyOpen && unverified(open) && (
                <form
                  onSubmit={verifyReg}
                  className="frame"
                  style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  <div className="kicker">Verify regulation entry</div>
                  <label className="field">
                    <span>Source URL</span>
                    <input className="input" value={vSource} onChange={e => setVSource(e.target.value)} required />
                  </label>
                  <label className="field">
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Verbatim text (from official regulator source)</span>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={!vSource || fetchingKey === 'vfetch'}
                        onClick={() => runLiveFetch({ url: vSource, regId: open.reg_id, intoField: 'verify' })}
                      >
                        ⚡ Pull from Source URL
                      </button>
                    </span>
                    <textarea
                      className="input"
                      rows={5}
                      value={vText}
                      onChange={e => setVText(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label className="field">
                    <span>Verification notes (optional)</span>
                    <input className="input" value={vNotes} onChange={e => setVNotes(e.target.value)} />
                  </label>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                      Mark Verified
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ color: 'var(--bad)' }}
                      disabled={busy}
                      onClick={async () => {
                        if (!window.confirm(`Delete unverified draft citation ${open.code}?`)) return;
                        setBusy(true);
                        const res = await fetch('/api/regulations', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ action: 'delete_unverified', regId: open.reg_id }),
                        });
                        const body = await res.json();
                        setBusy(false);
                        notify(res.ok ? body.message : body.error);
                        if (res.ok) {
                          setOpen(null);
                          router.refresh();
                        }
                      }}
                    >
                      Delete Unverified Draft
                    </button>
                  </div>
                </form>
              )}

              {canModifyOpen && superseding && (
                <form
                  onSubmit={supersedeReg}
                  className="frame"
                  style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  <div className="kicker">Supersede {open.reg_id} with new verified entry</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label className="field">
                      <span>Code</span>
                      <input className="input" value={sCode} onChange={e => setSCode(e.target.value)} required />
                    </label>
                    <label className="field">
                      <span>Title</span>
                      <input className="input" value={sTitle} onChange={e => setSTitle(e.target.value)} required />
                    </label>
                  </div>
                  <label className="field">
                    <span>Plain-language summary</span>
                    <textarea
                      className="input"
                      rows={2}
                      value={sSummary}
                      onChange={e => setSSummary(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label className="field">
                    <span>Verbatim text</span>
                    <textarea
                      className="input"
                      rows={4}
                      value={vText}
                      onChange={e => setVText(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label className="field">
                    <span>Source URL</span>
                    <input className="input" value={vSource} onChange={e => setVSource(e.target.value)} required />
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                      Create Replacement &amp; Supersede
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setSuperseding(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </aside>
        </>
      )}

      {/* CREATE CITATION DRAWER */}
      {creating && (
        <>
          <div className="drawer-bg" onClick={() => setCreating(false)} />
          <aside className="drawer" role="dialog" aria-label="Add regulation" style={{ maxWidth: 640, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Regulation library</div>
                <h2>Add Regulation Citation</h2>
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
            <form onSubmit={createReg} className="drawer-body">
              {canGlobal && hasTeamWorkspace && canSupplemental && (
                <label className="field">
                  <span>Library Scope</span>
                  <select className="select" value={cScope} onChange={e => setCScope(e.target.value as any)}>
                    <option value="tenant">Workspace-Supplemental Citation (This Tenant Only)</option>
                    <option value="global">Global Master Citation (All Tenants · Platform Plane)</option>
                  </select>
                </label>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10 }}>
                <label className="field">
                  <span>Jurisdiction</span>
                  <select className="select" value={cJur} onChange={e => setCJur(e.target.value)}>
                    <option value="FED">FED (29 CFR)</option>
                    {statePortalCodes.map(x => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Agency</span>
                  <input
                    className="input"
                    value={cAgency}
                    onChange={e => setCAgency(e.target.value)}
                    required
                    placeholder="Cal/OSHA / WA DOSH / OR-OSHA / MIOSHA / OSHA"
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Citation code</span>
                  <input
                    className="input"
                    value={cCode}
                    onChange={e => setCCode(e.target.value)}
                    required
                    placeholder="8 CCR §3396"
                  />
                </label>
                <label className="field">
                  <span>Topic key</span>
                  <input
                    className="input"
                    value={cTopic}
                    onChange={e => setCTopic(e.target.value)}
                    required
                    placeholder="heat_illness"
                  />
                </label>
              </div>

              <label className="field">
                <span>Official title</span>
                <input
                  className="input"
                  value={cTitle}
                  onChange={e => setCTitle(e.target.value)}
                  required
                  placeholder="Heat Illness Prevention in Indoor Places of Employment"
                />
              </label>

              <label className="field">
                <span>Plain-language summary</span>
                <textarea
                  className="input"
                  rows={2}
                  value={cSummary}
                  onChange={e => setCSummary(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </label>

              <label className="field">
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Official .gov Source URL</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!cSource}
                    onClick={() => runLiveFetch({ url: cSource, intoField: 'create' })}
                  >
                    ⚡ Fetch Live Text from URL
                  </button>
                </span>
                <input
                  className="input mono"
                  value={cSource}
                  onChange={e => setCSource(e.target.value)}
                  placeholder="https://www.dir.ca.gov/title8/3396.html"
                  required
                />
              </label>

              <label className="field">
                <span>Verbatim clause text (optional unless verifying immediately)</span>
                <textarea
                  className="input"
                  rows={4}
                  value={cVerbatim}
                  onChange={e => setCVerbatim(e.target.value)}
                  style={{ width: '100%' }}
                />
              </label>

              <label className="field">
                <span>Notes</span>
                <input className="input" value={cNotes} onChange={e => setCNotes(e.target.value)} />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={cVerifyNow} onChange={e => setCVerifyNow(e.target.checked)} />
                <span>Mark as verified immediately (requires verbatim text)</span>
              </label>

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || (cVerifyNow && !cVerbatim.trim())}
                >
                  Save Regulation Citation
                </button>
                <button type="button" className="btn" onClick={() => setCreating(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* EDIT JURISDICTION PORTAL DRAWER */}
      {editingPortal && (
        <>
          <div className="drawer-bg" onClick={() => setEditingPortal(null)} />
          <aside className="drawer" role="dialog" style={{ maxWidth: 600, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">56-Jurisdiction Portal Configuration · {editingPortal.code}</div>
                <h2>Edit {editingPortal.name}</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setEditingPortal(null)}>
                ×
              </button>
            </div>
            <form
              className="drawer-body"
              onSubmit={async e => {
                e.preventDefault();
                setBusy(true);
                const res = await fetch('/api/regulations', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    action: 'update_portal',
                    code: editingPortal.code,
                    agencyName: epAgency,
                    adminCodeCitation: epAdminCode,
                    portalUrl: epPortalUrl,
                    standardsUrl: epStandardsUrl,
                    keyDivergences: epDivergence,
                  }),
                });
                const body = await res.json();
                setBusy(false);
                notify(res.ok ? body.message : body.error);
                if (res.ok) {
                  setEditingPortal(null);
                  router.refresh();
                }
              }}
            >
              <label className="field">
                <span>Enforcing Agency Name</span>
                <input className="input" value={epAgency} onChange={e => setEpAgency(e.target.value)} required />
              </label>
              <label className="field">
                <span>Administrative Code Citation</span>
                <input className="input" value={epAdminCode} onChange={e => setEpAdminCode(e.target.value)} placeholder="Title 8 CCR / WAC 296 / 29 CFR" />
              </label>
              <label className="field">
                <span>Official Agency Portal URL</span>
                <input className="input mono" value={epPortalUrl} onChange={e => setEpPortalUrl(e.target.value)} required />
              </label>
              <label className="field">
                <span>Official Standards / Statutory Index URL</span>
                <input className="input mono" value={epStandardsUrl} onChange={e => setEpStandardsUrl(e.target.value)} />
              </label>
              <label className="field">
                <span>Key State Plan Divergences &amp; Notes</span>
                <textarea className="input" rows={4} value={epDivergence} onChange={e => setEpDivergence(e.target.value)} />
              </label>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Save Portal Settings
                </button>
                <button type="button" className="btn" onClick={() => setEditingPortal(null)}>
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
