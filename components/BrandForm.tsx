'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from './ui';
import { contrastOnWhite, guardAccent } from '@/lib/color';

const ACCENTS = ['#4b2454', '#1f4f6e', '#7a3b1d', '#3d3d6b', '#1f4a3a'];
const SCOPES: [string, string][] = [
  ['app', 'Console and field app'],
  ['reports', 'Reports (Printable & ARU Packet PDFs)'],
  ['email', 'Emails to Members'],
  ['portal', 'Member Client Portal'],
  ['signin', 'Unified SSO Sign-in page'],
];

type SSOConfig = {
  enabled: boolean;
  providerName: string;
  issuerUrl: string;
  clientId: string;
  authorizationUrl: string;
};

type T = {
  name: string;
  domain: string;
  sender: string;
  senderVerified: boolean;
  accent: string;
  logo: string;
  scopes: Record<string, boolean>;
  ssoConfig: SSOConfig;
};

export default function BrandForm({ tenant, portalPreviewHref }: { tenant: T; portalPreviewHref: string }) {
  const router = useRouter();
  const [t, setT] = useState<T>(tenant);
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ratio = contrastOnWhite(t.accent);
  const shown = guardAccent(t.accent);
  const set = (k: keyof T, v: any) => setT(p => ({ ...p, [k]: v }));
  const setSso = (k: keyof SSOConfig, v: any) =>
    setT(p => ({ ...p, ssoConfig: { ...p.ssoConfig, [k]: v } }));

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.toLowerCase().includes('svg') || file.name.toLowerCase().endsWith('.svg')) {
      setMsg('SVG logos are blocked to prevent stored script execution. Upload PNG, JPEG, or WebP.');
      setTimeout(() => setMsg(null), 3500);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setLogoDataUrl(dataUrl);
      set('logo', dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    const res = await fetch('/api/tenant/brand', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...t, logoDataUrl }),
    });
    const body = await res.json();
    setSaving(false);
    setMsg(res.ok ? 'Brand & SSO settings saved.' : body.error);
    setTimeout(() => setMsg(null), 3000);
    if (res.ok) {
      if (body.logo !== undefined) set('logo', body.logo);
      if (body.emailSenderVerified !== undefined) set('senderVerified', Boolean(body.emailSenderVerified));
      setLogoDataUrl('');
      router.refresh();
    }
  }

  const displayLogo = t.logo || '/brand/logo.png';

  return (
    <div className="cols" style={{ maxWidth: 1220, ['--acc' as string]: shown }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Frame className="strong">
          <div className="panel-head">
            <h2>Identity &amp; Verified Sender</h2>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="field">
              <span className="kicker">Business name</span>
              <input className="input" value={t.name} onChange={e => set('name', e.target.value)} />
            </label>

            <label className="field">
              <span className="kicker">Custom domain (for SSO domain discovery &amp; white-label headers)</span>
              <input
                className="input"
                value={t.domain}
                onChange={e => set('domain', e.target.value)}
                placeholder="safety.yourcompany.com"
              />
            </label>

            <label className="field">
              <span className="kicker" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Email sender</span>
                {t.sender ? (
                  t.senderVerified ? (
                    <Pill kind="verified">SPF/DKIM Verified</Pill>
                  ) : (
                    <Pill kind="amber">Pending Verification · Platform Fallback Used</Pill>
                  )
                ) : null}
              </span>
              <input
                className="input"
                type="email"
                value={t.sender}
                onChange={e => set('sender', e.target.value)}
                placeholder="safety@yourcompany.com"
              />
              <span className="sub">
                Until domain SPF/DKIM is verified by Platform Ops, outbound alerts send via verified platform relay with
                your brand display name to prevent sender spoofing.
              </span>
            </label>

            <div className="field">
              <span className="kicker">Brand Logo (PNG, JPEG, or WebP · Max 2 MB · SVG blocked for XSS safety)</span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <img
                  src={displayLogo}
                  alt="Brand logo"
                  style={{
                    height: 36,
                    maxWidth: 130,
                    objectFit: 'contain',
                    border: '1px solid var(--div)',
                    padding: 4,
                    background: '#fff',
                  }}
                />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoFile}
                  className="input"
                  style={{ flex: 1, paddingTop: 6 }}
                />
                {t.logo && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      set('logo', '');
                      setLogoDataUrl('');
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="field">
              <span className="kicker">Accent Color</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {ACCENTS.map(h => (
                  <button
                    key={h}
                    type="button"
                    aria-label={h}
                    onClick={() => set('accent', h)}
                    style={{
                      width: 40,
                      height: 40,
                      cursor: 'pointer',
                      background: h,
                      border: h === t.accent ? '2px solid var(--ink)' : '1px solid var(--div)',
                      outline: h === t.accent ? '2px solid #fff' : 'none',
                      outlineOffset: -4,
                    }}
                  />
                ))}
                <input
                  className="input"
                  value={t.accent}
                  onChange={e => set('accent', e.target.value)}
                  style={{ width: 110, fontFamily: 'var(--mono)' }}
                />
              </div>
              <span className="kicker" style={{ color: ratio >= 4.5 ? 'var(--ok)' : 'var(--bad7)' }}>
                White text on accent: {ratio.toFixed(1)}:1 ·{' '}
                {ratio >= 4.5 ? 'passes WCAG AA' : 'fails AA, darkened to ' + shown + ' on text surfaces'}
              </span>
            </div>

            <div className="field" style={{ gap: 0 }}>
              <span className="kicker" style={{ marginBottom: 4 }}>
                Apply brand to
              </span>
              {SCOPES.map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set('scopes', { ...t.scopes, [k]: !t.scopes[k] })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    border: 'none',
                    borderTop: '1px solid var(--div2)',
                    background: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 13,
                  }}
                >
                  <span style={{ flex: 1 }}>{l}</span>
                  <Pill kind={t.scopes[k] ? 'on' : 'line'}>{t.scopes[k] ? 'On' : 'Off'}</Pill>
                </button>
              ))}
            </div>
          </div>
        </Frame>

        <Frame>
          <div className="panel-head">
            <div>
              <h2>Enterprise OIDC / SAML Single Sign-On</h2>
              <div className="sub">
                Connect Microsoft Entra ID, Okta, or Google Workspace to Unified SSO at <code>/login</code>
              </div>
            </div>
            <Pill kind={t.ssoConfig.enabled ? 'ok' : 'line'}>
              {t.ssoConfig.enabled ? 'SSO Enabled' : 'Password / Magic Link'}
            </Pill>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={t.ssoConfig.enabled}
                onChange={e => setSso('enabled', e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>
                Enable Enterprise Identity Provider discovery for {t.domain || 'your workspace domain'}
              </span>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="field">
                <span className="kicker">Provider Display Label</span>
                <input
                  className="input"
                  value={t.ssoConfig.providerName}
                  onChange={e => setSso('providerName', e.target.value)}
                  placeholder="Microsoft Entra ID / Okta"
                />
              </label>
              <label className="field">
                <span className="kicker">OIDC Client ID / Entity ID</span>
                <input
                  className="input mono"
                  value={t.ssoConfig.clientId}
                  onChange={e => setSso('clientId', e.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </label>
            </div>

            <label className="field">
              <span className="kicker">Issuer URL</span>
              <input
                className="input mono"
                value={t.ssoConfig.issuerUrl}
                onChange={e => setSso('issuerUrl', e.target.value)}
                placeholder="https://login.microsoftonline.com/<tenant-id>/v2.0"
              />
            </label>

            <label className="field">
              <span className="kicker">IdP Authorization Redirect URL</span>
              <input
                className="input mono"
                value={t.ssoConfig.authorizationUrl}
                onChange={e => setSso('authorizationUrl', e.target.value)}
                placeholder="https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/authorize"
              />
            </label>

            <div style={{ paddingTop: 4 }}>
              <button className="btn btn-primary" type="button" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save Brand & Enterprise SSO'}
              </button>
            </div>
          </div>
        </Frame>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div className="frame">
          <div className="kicker" style={{ padding: '11px 16px', borderBottom: '1px solid var(--div)' }}>
            Report header · proof
          </div>
          <div style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: '3px solid var(--acc)' }}>
              <img src={displayLogo} alt="" style={{ height: 34 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 17px var(--fh)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--a7)' }}>
                  {t.name}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--n6)' }}>{t.domain}</div>
              </div>
              <span className="pill" style={{ background: 'var(--acc)' }}>
                Recommendation report
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              <Pill kind="open">Open</Pill>
              <Pill kind="corrected">Corrected</Pill>
              <Pill kind="assumed">Risk assumed</Pill>
              <Pill kind="pending">Pending review</Pill>
            </div>
            <p className="note" style={{ marginTop: 12 }}>
              Open, Corrected and Risk Assumed keep their fixed safety colors under every brand. Pending review follows
              your accent.
            </p>
          </div>
        </div>

        <div className="frame">
          <div className="kicker" style={{ padding: '11px 16px', borderBottom: '1px solid var(--div)' }}>
            Member email &amp; magic-link portal · live proof
          </div>
          <div style={{ padding: '16px 18px', fontSize: 13, lineHeight: 1.55 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>
              From: {t.name} &lt;{t.senderVerified && t.sender ? t.sender : 'notifications@safetyalchemist.com'}&gt;
            </div>
            <div>Your inspection report is ready. Some recommendations require a 30-day response or correction photo.</div>
            <Link
              href={portalPreviewHref}
              style={{
                marginTop: 12,
                display: 'inline-flex',
                padding: '10px 16px',
                background: 'var(--acc)',
                color: '#fff',
                font: '600 12px var(--fb)',
                letterSpacing: '.04em',
              }}
            >
              Open Member Magic-Link Sign-In ↗
            </Link>
            <div className="sub" style={{ marginTop: 8 }}>
              Raw member ID URLs are blocked in v0.0.3 — Members authenticate via single-use SHA-256 magic link tokens.
            </div>
          </div>
        </div>
      </div>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
