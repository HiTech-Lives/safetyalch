'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from './ui';
import { contrastOnWhite, guardAccent } from '@/lib/color';

const ACCENTS = ['#4b2454', '#1f4f6e', '#7a3b1d', '#3d3d6b', '#1f4a3a'];
const SCOPES: [string, string][] = [
  ['app', 'Console and field app'],
  ['reports', 'Reports (both PDFs)'],
  ['email', 'Emails to Members'],
  ['portal', 'Member dashboard'],
  ['signin', 'Sign-in page'],
];

type T = { name: string; domain: string; sender: string; accent: string; logo: string; scopes: Record<string, boolean> };

export default function BrandForm({ tenant, portalPreviewHref }: { tenant: T; portalPreviewHref: string }) {
  const router = useRouter();
  const [t, setT] = useState<T>(tenant);
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const [msg, setMsg] = useState<string | null>(null);
  const ratio = contrastOnWhite(t.accent);
  const shown = guardAccent(t.accent);
  const set = (k: keyof T, v: any) => setT(p => ({ ...p, [k]: v }));

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setLogoDataUrl(dataUrl);
      set('logo', dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    const res = await fetch('/api/tenant/brand', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...t, logoDataUrl }),
    });
    const body = await res.json();
    setMsg(res.ok ? 'Brand saved.' : body.error);
    setTimeout(() => setMsg(null), 2600);
    if (res.ok) {
      if (body.logo) set('logo', body.logo);
      setLogoDataUrl('');
      router.refresh();
    }
  }

  const displayLogo = t.logo || '/brand/logo.png';

  return (
    <div className="cols" style={{ maxWidth: 1200, ['--acc' as string]: shown }}>
      <Frame className="strong">
        <div className="panel-head"><h2>Identity</h2></div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {([['Business name', 'name'], ['Custom domain', 'domain'], ['Email sender', 'sender']] as [string, keyof T][]).map(([l, k]) => (
            <label key={k} className="field"><span className="kicker">{l}</span><input className="input" value={t[k] as string} onChange={e => set(k, e.target.value)} /></label>
          ))}
          <div className="field">
            <span className="kicker">Brand Logo (PNG, SVG, or JPG)</span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <img src={displayLogo} alt="Brand logo" style={{ height: 34, maxWidth: 120, objectFit: 'contain', border: '1px solid var(--div)', padding: 4, background: '#fff' }} />
              <input type="file" accept="image/*" onChange={handleLogoFile} className="input" style={{ flex: 1, paddingTop: 6 }} />
              {t.logo && (
                <button type="button" className="btn btn-sm" onClick={() => { set('logo', ''); setLogoDataUrl(''); }}>
                  Reset
                </button>
              )}
            </div>
          </div>
          <div className="field">
            <span className="kicker">Accent</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {ACCENTS.map(h => (
                <button key={h} aria-label={h} onClick={() => set('accent', h)}
                  style={{ width: 40, height: 40, cursor: 'pointer', background: h, border: h === t.accent ? '2px solid var(--ink)' : '1px solid var(--div)', outline: h === t.accent ? '2px solid #fff' : 'none', outlineOffset: -4 }} />
              ))}
              <input className="input" value={t.accent} onChange={e => set('accent', e.target.value)} style={{ width: 110, fontFamily: 'var(--mono)' }} />
            </div>
            <span className="kicker" style={{ color: ratio >= 4.5 ? 'var(--ok)' : 'var(--bad7)' }}>
              White text on accent: {ratio.toFixed(1)}:1 · {ratio >= 4.5 ? 'passes AA' : 'fails AA, darkened to ' + shown + ' on text surfaces'}
            </span>
          </div>
          <div className="field" style={{ gap: 0 }}>
            <span className="kicker" style={{ marginBottom: 4 }}>Apply brand to</span>
            {SCOPES.map(([k, l]) => (
              <button key={k} onClick={() => set('scopes', { ...t.scopes, [k]: !t.scopes[k] })}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', border: 'none', borderTop: '1px solid var(--div2)', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>
                <span style={{ flex: 1 }}>{l}</span><Pill kind={t.scopes[k] ? 'on' : 'line'}>{t.scopes[k] ? 'On' : 'Off'}</Pill>
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={save} style={{ alignSelf: 'flex-start' }}>Save brand</button>
        </div>
      </Frame>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div className="frame">
          <div className="kicker" style={{ padding: '11px 16px', borderBottom: '1px solid var(--div)' }}>Report header · proof</div>
          <div style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: '3px solid var(--acc)' }}>
              <img src={displayLogo} alt="" style={{ height: 34 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 17px var(--fh)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--a7)' }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--n6)' }}>{t.domain}</div>
              </div>
              <span className="pill" style={{ background: 'var(--acc)' }}>Recommendation report</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              <Pill kind="open">Open</Pill><Pill kind="corrected">Corrected</Pill><Pill kind="assumed">Risk assumed</Pill><Pill kind="pending">Pending review</Pill>
            </div>
            <p className="note" style={{ marginTop: 12 }}>Open, Corrected and Risk Assumed keep their fixed colors under every brand. Pending review follows the accent.</p>
          </div>
        </div>
        <div className="frame">
          <div className="kicker" style={{ padding: '11px 16px', borderBottom: '1px solid var(--div)' }}>Member email &amp; portal · live proof</div>
          <div style={{ padding: '16px 18px', fontSize: 13, lineHeight: 1.55 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>From: {t.name} &lt;{t.sender}&gt;</div>
            <div>Your inspection report is ready. Some recommendations need a correction from you.</div>
            <Link
              href={portalPreviewHref}
              style={{ marginTop: 12, display: 'inline-flex', padding: '10px 16px', background: 'var(--acc)', color: '#fff', font: '600 12px var(--fb)', letterSpacing: '.04em' }}
            >
              Sign in to your Member dashboard ↗
            </Link>
            <div className="sub" style={{ marginTop: 8 }}>Click above to preview the live white-labeled Member Client Portal for this tenant.</div>
          </div>
        </div>
      </div>
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
