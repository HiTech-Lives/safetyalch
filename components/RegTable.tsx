'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pill } from './ui';
import { fmtDate } from '@/lib/format';

const unverified = (g: any) => !g.verified_on || String(g.status).startsWith('UNVERIFIED');
const JURISDICTIONS = ['CA', 'WA', 'OR', 'NV', 'FED', 'AZ', 'TX', 'UT'];

export default function RegTable({ regs, canEdit }: { regs: any[]; canEdit: boolean }) {
  const router = useRouter();
  const [j, setJ] = useState('All');
  const [t, setT] = useState('All');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [superseding, setSuperseding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Verify / Supersede state
  const [vText, setVText] = useState('');
  const [vSource, setVSource] = useState('');
  const [vNotes, setVNotes] = useState('');
  const [sCode, setSCode] = useState('');
  const [sTitle, setSTitle] = useState('');
  const [sSummary, setSSummary] = useState('');

  // Create state
  const [cJur, setCJur] = useState('CA');
  const [cAgency, setCAgency] = useState('Cal/OSHA');
  const [cCode, setCCode] = useState('');
  const [cTitle, setCTitle] = useState('');
  const [cTopic, setCTopic] = useState('machine_guarding');
  const [cSummary, setCSummary] = useState('');
  const [cVerbatim, setCVerbatim] = useState('');
  const [cSource, setCSource] = useState('');
  const [cNotes, setCNotes] = useState('');
  const [cVerifyNow, setCVerifyNow] = useState(false);

  const js = ['All', ...Array.from(new Set(regs.map(g => g.jurisdiction)))];
  const ts = ['All', ...Array.from(new Set(regs.map(g => g.topic))).sort()];
  const rows = useMemo(
    () => regs.filter(g => (j === 'All' || g.jurisdiction === j) && (t === 'All' || g.topic === t) && (!q || (g.code + g.title + g.summary).toLowerCase().includes(q.toLowerCase()))),
    [regs, j, t, q]
  );

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
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
      setCCode(''); setCTitle(''); setCSummary(''); setCVerbatim(''); setCSource(''); setCNotes('');
      router.refresh();
    }
  }

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <label className="kicker" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>Jurisdiction
          <select className="select" value={j} onChange={e => setJ(e.target.value)}>{js.map(o => <option key={o}>{o}</option>)}</select>
        </label>
        <label className="kicker" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>Topic
          <select className="select" value={t} onChange={e => setT(e.target.value)}>{ts.map(o => <option key={o}>{o}</option>)}</select>
        </label>
        <label className="search"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search code or title" /></label>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--n6)' }}>
          {regs.length} entries · {regs.filter(unverified).length} awaiting verification
        </span>
        {canEdit && (
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Add regulation</button>
        )}
      </div>
      <div className="tbl-wrap">
        <table className="tbl" style={{ minWidth: 900 }}>
          <thead><tr><th>Code</th><th>Title</th><th>Agency</th><th>Jur.</th><th>Topic</th><th>Verified</th></tr></thead>
          <tbody>
            {rows.map(g => (
              <tr key={g.reg_id} className="click" onClick={() => selectReg(g)}>
                <td className="code" style={{ whiteSpace: 'nowrap' }}>{g.code}</td>
                <td>{g.title}</td>
                <td style={{ fontSize: 12 }}>{g.agency}</td>
                <td className="kicker" style={{ color: 'var(--ink)' }}>{g.jurisdiction}</td>
                <td style={{ font: '500 10.5px var(--mono)', color: 'var(--n7)' }}>{g.topic}</td>
                <td>{g.status === 'superseded' ? <Pill kind="line">Superseded</Pill> : unverified(g) ? <Pill kind="unverified">Unverified</Pill> : <Pill kind="verified">{fmtDate(g.verified_on)}</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <>
          <div className="drawer-bg" onClick={() => setOpen(null)} />
          <aside className="drawer" role="dialog">
            <div className="drawer-head">
              <div style={{ flex: 1 }}><div className="kicker">{open.reg_id} · {open.agency}</div><h2>{open.code}</h2></div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setOpen(null)} aria-label="Close">×</button>
            </div>
            <div className="drawer-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span>
                  {open.status === 'superseded' ? <Pill kind="line">Superseded by {open.superseded_by}</Pill> : unverified(open) ? <Pill kind="unverified">Unverified</Pill> : <Pill kind="verified">Verified</Pill>}
                </span>
                {canEdit && !unverified(open) && open.status !== 'superseded' && !superseding && (
                  <button className="btn btn-sm" onClick={() => setSuperseding(true)}>
                    Supersede with new entry
                  </button>
                )}
              </div>
              <div style={{ fontSize: 14.5, lineHeight: 1.5 }}>{open.title}. {open.summary}</div>
              <dl className="frame facts" style={{ margin: 0 }}>
                {[['Jurisdiction', open.jurisdiction], ['Topic', open.topic], ['Source', open.source_url], ['Verified on', open.verified_on ? fmtDate(open.verified_on) : 'Not yet'],
                  ['Verified by', open.verified_by || '—'], ['Status', open.status], ['Superseded by', open.superseded_by || '—'], ['Notes', open.notes || '—']]
                  .map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              {!open.verbatim_text && <div className="banner dashed">Verbatim text has not been pasted from the source yet. Citations print the summary until it is verified.</div>}
              {open.verbatim_text && <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{open.verbatim_text}</div>}

              {canEdit && unverified(open) && (
                <form onSubmit={verifyReg} className="frame" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="kicker">Verify regulation entry</div>
                  <div style={{ fontSize: 12, color: 'var(--n6)' }}>
                    Paste the verbatim clause text from the official regulator page. Once verified, this entry becomes immutable for 7-year citation retention.
                  </div>
                  <label className="field">
                    <span>Source URL</span>
                    <input className="input" value={vSource} onChange={e => setVSource(e.target.value)} required />
                  </label>
                  <label className="field">
                    <span>Verbatim text (1–3 sentences from official source)</span>
                    <textarea className="input" rows={4} value={vText} onChange={e => setVText(e.target.value)} required style={{ width: '100%' }} />
                  </label>
                  <label className="field">
                    <span>Verification notes (optional)</span>
                    <input className="input" value={vNotes} onChange={e => setVNotes(e.target.value)} />
                  </label>
                  <div>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Mark verified</button>
                  </div>
                </form>
              )}

              {canEdit && superseding && (
                <form onSubmit={supersedeReg} className="frame" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="kicker">Supersede {open.reg_id} with new verified entry</div>
                  <div style={{ fontSize: 12, color: 'var(--n6)' }}>
                    Verified entries are never edited in place. Saving creates a new regulation ID and marks {open.reg_id} as superseded.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label className="field"><span>Code</span><input className="input" value={sCode} onChange={e => setSCode(e.target.value)} required /></label>
                    <label className="field"><span>Title</span><input className="input" value={sTitle} onChange={e => setSTitle(e.target.value)} required /></label>
                  </div>
                  <label className="field"><span>Plain-language summary</span><textarea className="input" rows={2} value={sSummary} onChange={e => setSSummary(e.target.value)} required style={{ width: '100%' }} /></label>
                  <label className="field"><span>Verbatim text</span><textarea className="input" rows={4} value={vText} onChange={e => setVText(e.target.value)} required style={{ width: '100%' }} /></label>
                  <label className="field"><span>Source URL</span><input className="input" value={vSource} onChange={e => setVSource(e.target.value)} required /></label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Create replacement &amp; supersede</button>
                    <button type="button" className="btn btn-sm" onClick={() => setSuperseding(false)}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          </aside>
        </>
      )}

      {creating && (
        <>
          <div className="drawer-bg" onClick={() => setCreating(false)} />
          <aside className="drawer" role="dialog" aria-label="Add regulation">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Regulation library</div>
                <h2>Add Regulation Citation</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setCreating(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={createReg} className="drawer-body">
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
                <label className="field">
                  <span>Jurisdiction</span>
                  <select className="select" value={cJur} onChange={e => setCJur(e.target.value)}>
                    {JURISDICTIONS.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Agency</span>
                  <input className="input" value={cAgency} onChange={e => setCAgency(e.target.value)} required placeholder="OR-OSHA / OSHA / WorkSafeBC" />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="field"><span>Citation code</span><input className="input" value={cCode} onChange={e => setCCode(e.target.value)} required placeholder="OAR 437-002-0242" /></label>
                <label className="field"><span>Topic key</span><input className="input" value={cTopic} onChange={e => setCTopic(e.target.value)} required placeholder="machine_guarding" /></label>
              </div>
              <label className="field"><span>Official title</span><input className="input" value={cTitle} onChange={e => setCTitle(e.target.value)} required placeholder="Machine Guarding — General Requirements" /></label>
              <label className="field"><span>Plain-language summary (1 sentence)</span><textarea className="input" rows={2} value={cSummary} onChange={e => setCSummary(e.target.value)} required style={{ width: '100%' }} /></label>
              <label className="field"><span>Source URL</span><input className="input" value={cSource} onChange={e => setCSource(e.target.value)} placeholder="https://..." /></label>
              <label className="field"><span>Verbatim clause text (optional unless verifying now)</span><textarea className="input" rows={3} value={cVerbatim} onChange={e => setCVerbatim(e.target.value)} style={{ width: '100%' }} /></label>
              <label className="field"><span>Notes</span><input className="input" value={cNotes} onChange={e => setCNotes(e.target.value)} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={cVerifyNow} onChange={e => setCVerifyNow(e.target.checked)} />
                <span>Mark as verified immediately (requires verbatim text)</span>
              </label>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy || (cVerifyNow && !cVerbatim.trim())}>Save regulation</button>
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
