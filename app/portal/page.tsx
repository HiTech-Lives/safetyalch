'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Frame, Pill } from '@/components/ui';

const DEMO_PORTALS = [
  {
    token: 'demo-portal-m1',
    member: 'Ridgeline Distribution',
    contact: 'M. Ruiz (mruiz@example.com)',
    tenant: 'The Safety Alchemist (Purple Brand)',
    sites: 'Fresno DC (CA), Bakersfield Yard (CA)',
  },
  {
    token: 'demo-portal-m2',
    member: 'Valley Crest Farms',
    contact: 'A. Castillo (acastillo@example.com)',
    tenant: 'The Safety Alchemist (Purple Brand)',
    sites: 'Packing House (CA), North Ranch (CA), Labor Camp 3 H-2A (CA)',
  },
  {
    token: 'demo-portal-m7',
    member: 'Puget Sound Marine Works',
    contact: 'D. Mercer (dmercer@example.com)',
    tenant: 'Northwest Compliance Partners (Navy Brand)',
    sites: 'Harbor Shipyard (WA)',
  },
];

export default function PortalIndexPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message?: string; portalUrl?: string; error?: string } | null>(null);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'request_magic_link', email }),
    });
    const body = await res.json();
    setBusy(false);
    setResult(res.ok ? body : { error: body.error });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'var(--ink)', color: '#fff', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
          <img src="/brand/logo.png" alt="The Safety Alchemist" style={{ height: 28, filter: 'brightness(0) invert(1)' }} />
          <span style={{ font: '700 17px var(--fh)', letterSpacing: '.05em', textTransform: 'uppercase' }}>Member Client Portal</span>
        </Link>
        <div style={{ display: 'flex', gap: 14, fontSize: 12.5 }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,.78)' }}>← Public Home</Link>
          <Link href="/today" style={{ color: 'var(--sand)', fontWeight: 600 }}>Staff Console →</Link>
        </div>
      </header>

      <div style={{ flex: 1, maxWidth: 980, width: '100%', margin: '0 auto', padding: '44px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, alignItems: 'start' }}>
        <Frame className="strong" style={{ padding: 24 }}>
          <div className="kicker">Passwordless Client Access</div>
          <h1 style={{ margin: '4px 0 12px', font: '700 26px/1.1 var(--fh)', textTransform: 'uppercase' }}>
            Request Your One-Time Member Sign-In Link
          </h1>
          <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--n6)', lineHeight: 1.55 }}>
            Member contacts never need a password. Enter the email address on file for your facility to receive a magic link to view your inspection reports, upload correction photos, or sign a Risk Assumed statement.
          </p>
          {result?.error && <div className="banner warn" style={{ marginBottom: 12 }}>{result.error}</div>}
          {result?.message && (
            <div className="frame" style={{ padding: 14, marginBottom: 14, background: 'var(--a1)' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{result.message}</div>
              {result.portalUrl && (
                <div style={{ marginTop: 8 }}>
                  <Link href={result.portalUrl} className="btn btn-primary btn-sm">Open Generated Link Now →</Link>
                </div>
              )}
            </div>
          )}
          <form onSubmit={requestLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label className="field">
              <span>Primary Member Contact Email</span>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="mruiz@example.com" />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Sending magic link…' : 'Email My Sign-In Link'}
            </button>
          </form>
        </Frame>

        <Frame style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kicker">Live White-Labeled Demo Portals</span>
            <Pill kind="verified">Multi-Tenant</Pill>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--n6)', lineHeight: 1.5 }}>
            Inspect how different Member organizations experience their consultancy&apos;s white-labeled portal:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DEMO_PORTALS.map(p => (
              <Link
                key={p.token}
                href={`/portal/${p.token}`}
                className="frame"
                style={{ padding: '12px 14px', color: 'var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.member}</div>
                  <div className="sub">{p.contact} · {p.sites}</div>
                  <div className="kicker" style={{ marginTop: 4, color: 'var(--a7)' }}>{p.tenant}</div>
                </div>
                <span style={{ font: '700 13px var(--fh)' }}>OPEN →</span>
              </Link>
            ))}
          </div>
        </Frame>
      </div>
    </div>
  );
}

