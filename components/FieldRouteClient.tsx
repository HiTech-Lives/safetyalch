'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function FieldRouteClient({ visits }: { visits: any[] }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [range, setRange] = useState<'day' | 'week'>('day');
  const [sendingId, setSendingId] = useState<string | null>(null);

  const stops = visits.filter(v => (range === 'day' ? v.scheduled_for === today : true));
  const activeStops = stops.length > 0 ? stops : visits;

  // Build Google Maps multi-stop route URL (Matches "Navigate the rest of the day (N stops)" at 02:18 in Video)
  function buildMultiStopMapsUrl() {
    const addresses = activeStops.map(s => encodeURIComponent(s.site_address || `${s.site}, ${s.member}`));
    if (addresses.length === 0) return 'https://www.google.com/maps';
    if (addresses.length === 1) return `https://www.google.com/maps/dir/?api=1&destination=${addresses[0]}`;
    const dest = addresses[addresses.length - 1];
    const waypoints = addresses.slice(0, -1).join('|');
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${waypoints}`;
  }

  async function sendConfirmationEmail(visit: any) {
    setSendingId(visit.id);
    await fetch(`/api/confirm-visit/${visit.confirm_token || 'new'}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'send_confirmation', visit_id: visit.id }),
    });
    setSendingId(null);
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Route Toolbar (Matches 02:10 - 02:20 in Video) */}
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className={'btn btn-sm ' + (range === 'day' ? 'btn-primary' : '')}
              onClick={() => setRange('day')}
            >
              Day ({visits.filter(v => v.scheduled_for === today).length})
            </button>
            <button
              type="button"
              className={'btn btn-sm ' + (range === 'week' ? 'btn-primary' : '')}
              onClick={() => setRange('week')}
            >
              Week ({visits.length})
            </button>
            <Link href="/schedule" className="btn btn-sm">
              + Add visit
            </Link>
          </div>

          <a
            href={buildMultiStopMapsUrl()}
            target="_blank"
            rel="noreferrer"
            className="btn btn-acc"
          >
            Navigate the rest of the day ({activeStops.length} stops) ↗
          </a>
        </div>
      </div>

      {/* Ordered Route Stop Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {activeStops.map((v, idx) => {
          const singleMapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            v.site_address || `${v.site}, ${v.member}`
          )}`;
          const confirmUrl = v.confirm_token ? `/confirm-visit/${v.confirm_token}` : null;

          return (
            <div key={v.id} className="card" style={{ borderLeft: '4px solid var(--acc)' }}>
              <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="chip mono" style={{ fontWeight: 700 }}>
                    STOP {idx + 1}
                  </span>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>
                    {v.scheduled_for} · {v.start_time || '09:00 AM'} ({v.duration_minutes || 90} min)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {v.confirm_status === 'confirmed' ? (
                    <span className="chip ok">
                      Confirmed ✓ ({v.confirmed_by_name || v.site_contact_name || 'Site Contact'})
                    </span>
                  ) : v.confirm_status === 'sent' ? (
                    <span className="chip warn">Confirmation Email Sent</span>
                  ) : v.confirm_status === 'reschedule_requested' ? (
                    <span className="chip danger">Reschedule Requested</span>
                  ) : (
                    <span className="chip">Unconfirmed</span>
                  )}
                </div>
              </div>

              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <div>
                    <div className="kicker">Policyholder &amp; Site</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{v.member}</div>
                    <div style={{ fontSize: 13 }}>{v.site_address || v.site}</div>
                  </div>
                  <div>
                    <div className="kicker">Site Contact</div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{v.site_contact_name || 'Primary Contact'}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {v.site_contact_phone || '—'} · {v.site_contact_email || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="kicker">Survey Form &amp; Required Credentials</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{v.form_name} ({v.form_code})</div>
                    {v.required_certs && (
                      <div className="mono muted" style={{ fontSize: 11.5 }}>
                        Requires: {v.required_certs}
                      </div>
                    )}
                  </div>
                </div>

                {v.confirm_notes && (
                  <div style={{ fontSize: 12, padding: '8px 12px', background: 'var(--bg-soft)', border: '1px solid var(--line)' }}>
                    <strong>Site Contact Note:</strong> {v.confirm_notes}
                  </div>
                )}

                {/* Action Strip (Matches 02:16 - 02:40 in Video) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 6, borderTop: '1px solid var(--line)' }}>
                  <a href={singleMapUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
                    Navigate ↗
                  </a>

                  <Link
                    href={`/field/capture?member=${v.member_id}&site=${v.site_id}&job=${v.job_id || ''}`}
                    className="btn btn-sm btn-acc"
                  >
                    Start capture (Photos + Voice AI) →
                  </Link>

                  <Link
                    href={`/field/quick-report?member=${v.member_id}&site=${v.site_id}&job=${v.job_id || ''}`}
                    className="btn btn-sm btn-primary"
                  >
                    Draft Quick Report →
                  </Link>

                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={sendingId === v.id}
                    onClick={() => sendConfirmationEmail(v)}
                  >
                    {v.confirm_status === 'sent' || v.confirm_status === 'confirmed'
                      ? 'Resend confirm'
                      : 'Email to confirm'}
                  </button>

                  {confirmUrl && (
                    <Link href={confirmUrl} className="btn btn-sm" style={{ borderStyle: 'dashed' }}>
                      Preview Site Contact Confirmation Page ↗
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

