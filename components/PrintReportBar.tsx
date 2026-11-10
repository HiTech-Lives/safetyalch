'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function PrintReportBar({
  id,
  entityType = 'inspection',
  mode,
  baseline = false,
  canShare = false,
  shareToken = null,
  backHref,
  backLabel,
}: {
  id: string;
  entityType?: 'inspection' | 'quick_report';
  mode: string;
  baseline?: boolean;
  canShare?: boolean;
  shareToken?: string | null;
  backHref?: string;
  backLabel?: string;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [recipient, setRecipient] = useState('Broker / Captive Underwriter');
  const [days, setDays] = useState(7);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [existingLinks, setExistingLinks] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const basePath = entityType === 'inspection' ? `/inspections/${id}/report` : `/quick-reports/${id}/report`;
  const buildModeUrl = (m: string) =>
    `${basePath}?mode=${encodeURIComponent(m)}${shareToken ? `&share=${encodeURIComponent(shareToken)}` : ''}`;

  async function openShareModal() {
    setShareOpen(true);
    setGeneratedUrl(null);
    const res = await fetch(`/api/share-links?entityType=${entityType}&entityId=${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = await res.json();
      setExistingLinks(data.links || []);
    }
  }

  async function createShareLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/share-links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        entityType,
        entityId: id,
        recipientLabel: recipient,
        reportMode: mode || 'full',
        days,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok && data.shareUrl) {
      const full = `${window.location.origin}${data.shareUrl}`;
      setGeneratedUrl(full);
      openShareModal();
      setGeneratedUrl(full);
    }
  }

  async function revokeLink(linkId: string) {
    setBusy(true);
    await fetch('/api/share-links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'revoke', id: linkId }),
    });
    setBusy(false);
    openShareModal();
  }

  return (
    <>
      <div
        className="no-print"
        style={{
          background: 'var(--ink)',
          color: '#fff',
          padding: '12px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {!shareToken && (
            <>
              <Link href={backHref || `/inspections/${id}`} style={{ color: '#fff', fontSize: 12.5 }}>
                ← {backLabel || `Record ${id}`}
              </Link>
              <span style={{ color: 'rgba(255,255,255,.35)' }}>|</span>
            </>
          )}

          {entityType === 'inspection' && (
            <>
              {(
                [
                  ['full', baseline ? 'Maturity & Roadmap' : '1. Full Report / Scorecard'],
                  ['letter', '2. ARU Visit Cover Letter'],
                  ['photos', '3. Location Photo Page'],
                  ['response', '4. 30-Day Board Response Form'],
                ] as const
              ).map(([mKey, mLabel]) => (
                <Link
                  key={mKey}
                  href={buildModeUrl(mKey)}
                  style={{
                    color: mode === mKey ? 'var(--sand)' : 'rgba(255,255,255,.78)',
                    fontSize: 12.5,
                    fontWeight: mode === mKey ? 700 : 400,
                    textDecoration: mode === mKey ? 'underline' : 'none',
                  }}
                >
                  {mLabel}
                </Link>
              ))}
            </>
          )}
          {shareToken && (
            <span style={{ fontSize: 11.5, color: 'var(--sand)', fontFamily: 'var(--mono)' }}>
              Read-Only Time-Limited External Share Session
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {canShare && !shareToken && (
            <button
              type="button"
              onClick={openShareModal}
              className="btn btn-sm"
              style={{ background: 'transparent', borderColor: 'rgba(255,255,255,.45)', color: '#fff' }}
            >
              🔗 Share Expiring Link (7d / 30d)
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-sm"
            style={{ background: 'var(--sand)', borderColor: 'var(--sand)', color: 'var(--ink)', fontWeight: 700 }}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      {shareOpen && (
        <>
          <div className="drawer-bg no-print" onClick={() => setShareOpen(false)} />
          <aside className="drawer no-print" role="dialog" style={{ maxWidth: 540, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Audited Read-Only External Report Sharing</div>
                <h2>Share {id} with Broker or Carrier</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setShareOpen(false)}>
                ×
              </button>
            </div>
            <div className="drawer-body">
              <form onSubmit={createShareLink} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="note">
                  Printable reports require authentication in v0.0.3. Generate a revocable, time-limited read-only token
                  link for external brokers or captive underwriters.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
                  <label className="field">
                    <span>Recipient Label (Audit Trail)</span>
                    <input
                      className="input"
                      value={recipient}
                      onChange={e => setRecipient(e.target.value)}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Expiration</span>
                    <select className="select" value={days} onChange={e => setDays(Number(e.target.value))}>
                      <option value={7}>7 Days</option>
                      <option value={14}>14 Days</option>
                      <option value={30}>30 Days</option>
                    </select>
                  </label>
                </div>
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy} style={{ alignSelf: 'flex-start' }}>
                  Generate Expiring Read-Only Link
                </button>
              </form>

              {generatedUrl && (
                <div className="frame strong" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="kicker" style={{ color: 'var(--ok)' }}>
                    ✓ Active Share Link Generated (Copy Now — Token Stored Hashed)
                  </div>
                  <input className="input mono" readOnly value={generatedUrl} onClick={e => (e.target as HTMLInputElement).select()} />
                </div>
              )}

              {existingLinks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <div className="kicker">Issued Links ({existingLinks.length})</div>
                  {existingLinks.map(l => (
                    <div
                      key={l.id}
                      style={{
                        padding: '8px 10px',
                        border: '1px solid var(--div2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {l.recipient_label} ({l.report_mode})
                        </div>
                        <div className="sub">
                          Expires {String(l.expires_at).slice(0, 10)} · {l.access_count} views
                          {l.revoked_at ? ' · REVOKED' : ''}
                        </div>
                      </div>
                      {!l.revoked_at && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ color: 'var(--bad)' }}
                          disabled={busy}
                          onClick={() => revokeLink(l.id)}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
