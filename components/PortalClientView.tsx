'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from './ui';
import { fmtDate, fmtShort, recState, STATE_LABEL, PRIORITY_DAYS } from '@/lib/format';

export default function PortalClientView({
  token,
  tenant,
  member,
  contact,
  sites,
  recs,
  inspections,
}: {
  token: string;
  tenant: any;
  member: any;
  contact: any;
  sites: any[];
  recs: any[];
  inspections: any[];
}) {
  const router = useRouter();
  const [activeRec, setActiveRec] = useState<any | null>(null);
  const [mode, setMode] = useState<'fix' | 'assume'>('fix');
  const [note, setNote] = useState('');
  const [signer, setSigner] = useState(contact.name);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  async function submitAction(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRec) return;
    setBusy(true);
    const payload =
      mode === 'fix'
        ? { action: 'submit_fix', recId: activeRec.id, note, photoDataUrl }
        : { action: 'assume_risk', recId: activeRec.id, reason: note, signer };

    const res = await fetch(`/api/portal/${token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setActiveRec(null);
      setNote('');
      setPhotoDataUrl('');
      router.refresh();
    }
  }

  const withState = recs.map(r => ({ ...r, state: recState(r.status, r.due_on) }));
  const openList = withState.filter(r => r.status === 'open');
  const pendingList = withState.filter(r => r.status === 'pending');
  const closedList = withState.filter(r => r.status === 'corrected' || r.status === 'assumed');

  return (
    <>
      <div className="stats">
        <div className="frame stat">
          <div className="kicker">Action Required</div>
          <div className="v" style={{ color: openList.length ? 'var(--bad)' : undefined }}>{openList.length}</div>
          <div className="h">open recommendations</div>
        </div>
        <div className="frame stat">
          <div className="kicker">Pending Review</div>
          <div className="v">{pendingList.length}</div>
          <div className="h">awaiting Consultant sign-off</div>
        </div>
        <div className="frame stat">
          <div className="kicker">Closed / Assumed</div>
          <div className="v" style={{ color: 'var(--ok)' }}>{closedList.length}</div>
          <div className="h">completed on file</div>
        </div>
        <div className="frame stat">
          <div className="kicker">Monitored Sites</div>
          <div className="v">{sites.length}</div>
          <div className="h">{sites.map(s => s.jurisdiction).join(', ')}</div>
        </div>
      </div>

      {/* Actionable Open Findings */}
      <Frame className="strong">
        <div className="panel-head">
          <h2>Open Recommendations Requiring Action ({openList.length})</h2>
          <span className="kicker">Upload correction proof or sign a Risk Assumed statement</span>
        </div>
        {openList.length === 0 && (
          <div style={{ padding: 20, fontSize: 13.5, color: 'var(--ok)', fontWeight: 500 }}>
            ✓ All recommendations for {member.name} have been addressed or are pending Consultant verification.
          </div>
        )}
        {openList.map(r => (
          <div key={r.id} style={{ padding: '16px 18px', borderTop: '1px solid var(--div2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span className="code">{r.id}</span>
              <Pill kind={r.state}>{STATE_LABEL[r.state as keyof typeof STATE_LABEL]}</Pill>
              <Pill kind="ink">{r.priority} · {PRIORITY_DAYS[r.priority as keyof typeof PRIORITY_DAYS]}d · due {fmtShort(r.due_on)}</Pill>
              <span className="kicker">{r.site_name} ({r.jurisdiction}) · Inspection {r.inspection_id}</span>
            </div>
            <div style={{ fontSize: 14.5, lineHeight: 1.5, fontWeight: 500 }}>{r.text}</div>
            {r.reg_code && (
              <div style={{ fontSize: 12, color: 'var(--n7)' }}>
                <strong>Citation:</strong> {r.reg_code} — {r.reg_title}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setActiveRec(r); setMode('fix'); setNote(''); setPhotoDataUrl(''); }}
              >
                Submit Correction + Photo
              </button>
              <button
                className="btn btn-sm"
                onClick={() => { setActiveRec(r); setMode('assume'); setNote(''); }}
              >
                Assume Risk in Writing
              </button>
            </div>
          </div>
        ))}
      </Frame>

      {/* Pending & Closed Findings */}
      {(pendingList.length > 0 || closedList.length > 0) && (
        <Frame>
          <div className="panel-head">
            <h2>Submitted &amp; Historical Recommendations ({pendingList.length + closedList.length})</h2>
          </div>
          {[...pendingList, ...closedList].map(r => (
            <div key={r.id} style={{ padding: '13px 18px', borderTop: '1px solid var(--div2)', display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="code">{r.id}</span>
                  <span className="kicker">{r.site_name} · due {fmtShort(r.due_on)}</span>
                </div>
                <div style={{ fontSize: 13.5 }}>{r.text}</div>
              </div>
              <Pill kind={r.state}>{STATE_LABEL[r.state as keyof typeof STATE_LABEL]}</Pill>
            </div>
          ))}
        </Frame>
      )}

      {/* Inspection Reports Archive */}
      <Frame>
        <div className="panel-head">
          <h2>Inspection Reports &amp; Printable PDFs ({inspections.length})</h2>
          <span className="kicker">7-Year Immutable Compliance Archive</span>
        </div>
        {inspections.map(i => (
          <div key={i.id} style={{ padding: '13px 18px', borderTop: '1px solid var(--div2)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                {i.id} · {i.site_name} ({i.jurisdiction}) — {i.form_code} · {i.form_name}
              </div>
              <div className="sub">Conducted {fmtDate(i.started_at)} by {i.consultant}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/inspections/${i.id}/report?type=full`} target="_blank" className="btn btn-sm">
                Full Report PDF ↗
              </Link>
              <Link
                href={`/inspections/${i.id}/report?type=${i.scale === 'maturity' ? 'development' : 'recommendations'}`}
                target="_blank"
                className="btn btn-primary btn-sm"
              >
                {i.scale === 'maturity' ? 'Development Plan PDF ↗' : 'Recommendation Report PDF ↗'}
              </Link>
            </div>
          </div>
        ))}
      </Frame>

      {activeRec && (
        <>
          <div className="drawer-bg" onClick={() => setActiveRec(null)} />
          <aside className="drawer" role="dialog" aria-label="Respond to recommendation">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">{activeRec.id} · {activeRec.site_name}</div>
                <h2>{mode === 'fix' ? 'Submit Hazard Correction' : 'Assume Risk in Writing'}</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setActiveRec(null)} aria-label="Close">×</button>
            </div>
            <form onSubmit={submitAction} className="drawer-body">
              <div style={{ fontSize: 13.5, lineHeight: 1.5, padding: 12, background: '#fff', border: '1px solid var(--div)' }}>
                {activeRec.text}
              </div>

              {mode === 'fix' ? (
                <>
                  <label className="field">
                    <span>Corrective Action Taken (Required)</span>
                    <textarea
                      className="input"
                      rows={4}
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      required
                      placeholder="Describe what was repaired, installed, or updated…"
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label className="field">
                    <span>Upload Proof Photo (Optional)</span>
                    <input type="file" accept="image/*" onChange={handleFile} className="input" style={{ paddingTop: 6 }} />
                  </label>
                  {photoDataUrl && (
                    <div className="frame" style={{ padding: 8 }}>
                      <img src={photoDataUrl} alt="Correction preview" style={{ maxWidth: '100%', maxHeight: 180, display: 'block' }} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="banner warn">
                    Assuming risk closes this recommendation without physical abatement. Your written statement and signature print permanently under the finding on the report and are shown on the next inspection visit.
                  </div>
                  <label className="field">
                    <span>Written Justification / Operational Control</span>
                    <textarea
                      className="input"
                      rows={4}
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      required
                      placeholder="State why this risk is being accepted and any administrative controls in place…"
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label className="field">
                    <span>Authorized Signer Name &amp; Title</span>
                    <input className="input" value={signer} onChange={e => setSigner(e.target.value)} required />
                  </label>
                </>
              )}

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {mode === 'fix' ? 'Submit for Consultant Verification' : 'Sign & Record Risk Assumption'}
                </button>
                <button type="button" className="btn" onClick={() => setActiveRec(null)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
