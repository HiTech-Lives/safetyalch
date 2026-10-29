'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from './ui';
import { fmtDate, fmtDay } from '@/lib/format';

export default function FieldLauncherClient({
  inProgress,
  visits,
  members,
  forms,
}: {
  inProgress: any[];
  visits: any[];
  members: any[];
  forms: any[];
}) {
  const router = useRouter();
  const allSites = members.flatMap(m =>
    m.sites.map((st: any) => ({
      siteId: st.id,
      label: `${m.name} · ${st.name} (${st.jurisdiction})`,
    }))
  );
  const [siteId, setSiteId] = useState(allSites[0]?.siteId ?? '');
  const [formCode, setFormCode] = useState(forms[0]?.code ?? 'WHS');
  const [busy, setBusy] = useState(false);

  async function startInspection(targetSiteId: string, targetFormCode: string, visitId?: string) {
    setBusy(true);
    const res = await fetch('/api/field', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'start_inspection',
        siteId: targetSiteId,
        formCode: targetFormCode,
        visitId: visitId || null,
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (res.ok && body.inspectionId) {
      router.push(`/field/${body.inspectionId}`);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* In-Progress Inspections */}
      <Frame className="strong">
        <div className="panel-head">
          <h2>In-Progress Field Inspections ({inProgress.length})</h2>
          <span className="kicker">Locked to device until submitted</span>
        </div>
        {inProgress.length === 0 && (
          <div style={{ padding: 18, fontSize: 13, color: 'var(--n6)' }}>No inspections currently in progress. Start one below.</div>
        )}
        {inProgress.map(i => (
          <div key={i.id} style={{ padding: '14px 18px', borderTop: '1px solid var(--div2)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="code">{i.id}</span>
                <Pill kind="in_progress">In Progress</Pill>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{i.member} · {i.site} ({i.jurisdiction})</span>
              </div>
              <div className="sub">{i.form_code} · {i.form_name} · Started {fmtDate(i.started_at)} by {i.consultant}</div>
            </div>
            <Link href={`/field/${i.id}`} className="btn btn-primary btn-sm">
              Resume Inspection →
            </Link>
          </div>
        ))}
      </Frame>

      <div className="detail">
        {/* Scheduled Visits Ready to Start */}
        <Frame>
          <div className="panel-head">
            <h2>Upcoming Scheduled Visits ({visits.length})</h2>
            <span className="kicker">One-tap launch</span>
          </div>
          {visits.map(v => (
            <div key={v.id} style={{ padding: '13px 18px', borderTop: '1px solid var(--div2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{fmtDay(v.scheduled_for)} — {v.member} · {v.site}</div>
                <div className="sub">{v.form_code} · {v.form_name} ({v.jurisdiction})</div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => startInspection(v.site_id, v.form_code, v.id)}
                className="btn btn-sm"
              >
                Start Inspection →
              </button>
            </div>
          ))}
        </Frame>

        {/* Start Ad-Hoc Inspection */}
        <Frame>
          <div className="panel-head"><h2>Start Ad-Hoc Inspection</h2></div>
          <form
            onSubmit={e => { e.preventDefault(); startInspection(siteId, formCode); }}
            style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <label className="field">
              <span>Assigned Member &amp; Site</span>
              <select className="select" value={siteId} onChange={e => setSiteId(e.target.value)} required>
                {allSites.map(s => <option key={s.siteId} value={s.siteId}>{s.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Inspection Form Template</span>
              <select className="select" value={formCode} onChange={e => setFormCode(e.target.value)} required>
                {forms.map(f => <option key={f.code} value={f.code}>{f.code} · {f.name}</option>)}
              </select>
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy || !siteId}>
              {busy ? 'Creating Inspection…' : '+ Start New Field Inspection'}
            </button>
          </form>
        </Frame>
      </div>
    </div>
  );
}

