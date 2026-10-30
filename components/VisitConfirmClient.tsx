'use client';
import Link from 'next/link';
import { useState } from 'react';

export default function VisitConfirmClient({ visit }: { visit: any }) {
  const [status, setStatus] = useState<string>(visit.confirm_status);
  const [mode, setMode] = useState<'none' | 'who_to_meet' | 'reschedule'>('none');
  const [altName, setAltName] = useState(visit.site_contact_name || '');
  const [altPhone, setAltPhone] = useState(visit.site_contact_phone || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');

  async function submitChoice(action: 'confirm_there' | 'confirm_alternate' | 'reschedule') {
    setSubmitting(true);
    const res = await fetch(`/api/confirm-visit/${visit.confirm_token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action,
        alternate_name: altName,
        alternate_phone: altPhone,
        notes,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.ok) {
      setStatus(data.status);
      setDoneMessage(
        action === 'reschedule'
          ? 'Thank you. We have notified your consultant to coordinate a new visit window.'
          : 'Visit confirmed! Your consultant’s mobile route has been updated in real time.'
      );
      setMode('none');
    }
  }

  return (
    <div className="card" style={{ maxWidth: 640, margin: '0 auto', border: '2px solid var(--ink)' }}>
      <div className="card-head">
        <div>
          <div className="kicker">Passwordless Site Contact Confirmation</div>
          <span className="card-title" style={{ fontSize: 19 }}>
            Confirm Scheduled Loss Control Visit
          </span>
        </div>
        <span
          className={
            'chip ' +
            (status === 'confirmed' ? 'ok' : status === 'reschedule_requested' ? 'danger' : 'warn')
          }
        >
          {status === 'confirmed'
            ? 'Confirmed ✓'
            : status === 'reschedule_requested'
            ? 'Reschedule Requested'
            : 'Awaiting Confirmation'}
        </span>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            padding: 16,
            background: 'var(--bg-soft)',
            border: '1px solid var(--line)',
            borderRadius: 4,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          <div>
            <div className="kicker">Policyholder / Insured</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{visit.member_name}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{visit.site_name}</div>
          </div>
          <div>
            <div className="kicker">Scheduled Date &amp; Time</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 15 }}>
              {visit.scheduled_for} · {visit.start_time || '09:00 AM'}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Est. duration: {visit.duration_minutes || 90} minutes
            </div>
          </div>
          <div>
            <div className="kicker">Site Address</div>
            <div style={{ fontSize: 13 }}>{visit.site_address || visit.site_name}</div>
          </div>
          <div>
            <div className="kicker">Assigned Consultant</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{visit.consultant_name || 'Senior Loss Control Consultant'}</div>
            <div className="muted" style={{ fontSize: 12 }}>Survey: {visit.form_name}</div>
          </div>
        </div>

        {doneMessage && (
          <div
            style={{
              padding: 14,
              background: status === 'confirmed' ? 'rgba(31,94,59,.1)' : 'rgba(232,154,30,.14)',
              border: '1px solid var(--line)',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            {doneMessage}
          </div>
        )}

        {/* 3 Exact No-Login Response Buttons from 02:28 in Safely Track Video */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            className="btn btn-acc"
            style={{ padding: '13px 18px', fontSize: 14, justifyContent: 'space-between' }}
            disabled={submitting}
            onClick={() => submitChoice('confirm_there')}
          >
            <span>1. Confirm, someone will be there</span>
            <span>✓</span>
          </button>

          <button
            type="button"
            className="btn"
            style={{ padding: '13px 18px', fontSize: 14, justifyContent: 'space-between' }}
            onClick={() => setMode(mode === 'who_to_meet' ? 'none' : 'who_to_meet')}
          >
            <span>2. Confirm and tell us who to meet</span>
            <span>→</span>
          </button>

          {mode === 'who_to_meet' && (
            <div
              style={{
                padding: 14,
                background: 'var(--bg-soft)',
                border: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field">
                  <label>Who should the consultant meet on site?</label>
                  <input type="text" value={altName} onChange={e => setAltName(e.target.value)} placeholder="Name & Title" />
                </div>
                <div className="field">
                  <label>Direct Cell / Site Phone</label>
                  <input type="text" value={altPhone} onChange={e => setAltPhone(e.target.value)} placeholder="(916) 555-0148" />
                </div>
              </div>
              <div className="field">
                <label>Gate code, PPE, or parking instructions (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Check in at West Gate trailer; hard hat & high-vis vest required."
                />
              </div>
              <button
                type="button"
                className="btn btn-acc"
                disabled={submitting}
                onClick={() => submitChoice('confirm_alternate')}
              >
                Save Contact &amp; Confirm Visit
              </button>
            </div>
          )}

          <button
            type="button"
            className="btn"
            style={{ padding: '13px 18px', fontSize: 14, justifyContent: 'space-between' }}
            onClick={() => setMode(mode === 'reschedule' ? 'none' : 'reschedule')}
          >
            <span>3. This time does not work</span>
            <span>↺</span>
          </button>

          {mode === 'reschedule' && (
            <div
              style={{
                padding: 14,
                background: 'var(--bg-soft)',
                border: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div className="field">
                <label>What dates or times work better for your team?</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Thursday morning after 10:00 AM works best."
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting}
                onClick={() => submitChoice('reschedule')}
              >
                Send Reschedule Request
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--line)', fontSize: 12 }}>
          <span className="muted">No account or password required · Encrypted site token</span>
          <Link href="/field/route" className="mono" style={{ color: 'var(--acc)', fontWeight: 600 }}>
            ← Return to Consultant Route View
          </Link>
        </div>
      </div>
    </div>
  );
}

