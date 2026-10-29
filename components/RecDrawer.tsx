'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pill } from './ui';
import { STATE_LABEL, PRIORITY_DAYS, fmtDate, recState, todayISO, daysBetween } from '@/lib/format';

type Data = { rec: any; events: any[]; canRevise?: boolean };

export default function RecDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editingText, setEditingText] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [noteText, setNoteText] = useState('');

  const load = () => fetch('/api/recommendations/' + id).then(r => (r.ok ? r.json() : Promise.reject(r.statusText))).then(d => {
    setData(d);
    if (d?.rec?.text) setDraftText(d.rec.text);
  }).catch(e => setErr(String(e)));
  useEffect(() => { setData(null); setEditingText(false); setNoteText(''); load(); }, [id]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    const res = await fetch('/api/recommendations/' + id + '/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    const body = await res.json();
    setBusy(false);
    setToast(res.ok ? body.message : body.error);
    setTimeout(() => setToast(null), 2600);
    if (res.ok) {
      if (action === 'revise_wording') setEditingText(false);
      if (action === 'add_note') setNoteText('');
      await load();
      router.refresh();
    }
  }

  const r = data?.rec;
  const st = r ? recState(r.status, r.due_on) : null;
  const overdueBy = r && st === 'overdue' ? daysBetween(r.due_on, todayISO()) : 0;

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={'Recommendation ' + id}>
        <div className="drawer-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kicker">{r ? r.id + ' · Q ' + r.question_id + ' · ' + r.form_code : id}</div>
            <h2>{r ? r.section_name : 'Loading…'}</h2>
          </div>
          <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="drawer-body">
          {err && <div className="banner warn">{err}</div>}
          {r && st && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <Pill kind={st}>{STATE_LABEL[st]}</Pill>
                {data?.canRevise && !editingText && (
                  <button className="btn btn-sm" onClick={() => { setDraftText(r.text); setEditingText(true); }}>
                    Revise wording
                  </button>
                )}
              </div>
              {editingText ? (
                <div className="frame" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="kicker">Revise finding wording (original is preserved on file)</div>
                  <textarea
                    className="input"
                    rows={3}
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" disabled={busy || !draftText.trim() || draftText.trim() === r.text} onClick={() => act('revise_wording', { text: draftText })}>
                      Save wording
                    </button>
                    <button className="btn btn-sm" disabled={busy} onClick={() => setEditingText(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 14.5, lineHeight: 1.5 }}>{r.text}</div>
              )}
              {r.original_text && (
                <div className="banner dashed" style={{ fontSize: 12 }}>
                  <strong>Wording revised{r.revised_by_name ? ' by ' + r.revised_by_name : ''}{r.revised_at ? ' on ' + fmtDate(r.revised_at) : ''}.</strong>{' '}
                  Original text on file: &ldquo;{r.original_text}&rdquo;
                </div>
              )}
              <dl className="frame facts" style={{ margin: 0 }}>
                {[
                  ['Question', r.question_text], ['Member', r.member + ' · ' + r.site], ['Consultant', r.consultant],
                  ['Priority', r.priority + ' · ' + PRIORITY_DAYS[r.priority as keyof typeof PRIORITY_DAYS] + ' days'],
                  ['Due', fmtDate(r.due_on) + (overdueBy ? ' · overdue ' + overdueBy + ' days' : '')],
                  ['Citation', r.reg_code ? r.reg_code + ' · ' + r.reg_title : 'No regulation mapped for ' + r.topic + ' in ' + r.jurisdiction],
                  ['Verified on', r.reg_code ? (r.reg_verified_on ? fmtDate(r.reg_verified_on) : 'Not yet verified') : '—'],
                ].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <div>
                <div className="kicker" style={{ marginBottom: 8 }}>History &amp; Notes</div>
                <div className="timeline">
                  {data!.events.map((e, i) => (
                    <div key={i}>
                      <div className="kicker">{fmtDate(e.at)}</div>
                      {e.note}{e.user_name && !e.note?.includes(e.user_name) ? ' ' + e.user_name + '.' : ''}
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={e => { e.preventDefault(); if (noteText.trim()) act('add_note', { note: noteText }); }}
                  style={{ display: 'flex', gap: 8, marginTop: 12 }}
                >
                  <input
                    className="input"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Append an immutable note to this record…"
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn btn-sm" disabled={busy || !noteText.trim()}>Add note</button>
                </form>
              </div>
              {(r.status === 'assumed' || r.status === 'corrected') && (
                <div className="banner dashed">
                  {r.status === 'assumed'
                    ? 'The Member accepted this risk in writing. It prints under the recommendation and is shown, not actionable, on the next visit.'
                    : 'Closed. The record is immutable for 7 years; notes may still be appended.'}
                </div>
              )}
            </>
          )}
        </div>
        {r && (r.status === 'pending' || r.status === 'open') && (
          <div className="drawer-foot">
            {r.status === 'pending' && (
              <>
                <button className="btn btn-primary" disabled={busy} onClick={() => act('confirm')}>Confirm corrected</button>
                <button className="btn" disabled={busy} onClick={() => act('reject')}>Not fixed</button>
              </>
            )}
            {r.status === 'open' && (
              <>
                <button className="btn btn-primary" disabled={busy} onClick={() => act('resend')}>Resend sign-in link to {r.contact}</button>
                <button className="btn" disabled={busy} onClick={() => act('mark_corrected')}>Mark corrected</button>
              </>
            )}
          </div>
        )}
      </aside>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
