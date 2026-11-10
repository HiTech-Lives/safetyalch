'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Frame, Pill } from '@/components/ui';

export default function PortalIndexPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message?: string; demoPortalUrl?: string; error?: string } | null>(null);

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
        <Link href="/" aria-label="The Safety Alchemist Home" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
          <img src="/brand/logo.png" alt="The Safety Alchemist" style={{ height: 30, filter: 'brightness(0) invert(1)' }} />
          <span style={{ font: '600 10.5px var(--mono)', padding: '2px 7px', border: '1px solid rgba(255,255,255,.3)', color: 'var(--sand)', textTransform: 'uppercase' }}>
            Member Portal
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 14, fontSize: 12.5 }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,.78)' }}>← Public Home</Link>
          <Link href="/login" style={{ color: 'var(--sand)', fontWeight: 600 }}>Unified Staff &amp; Admin SSO →</Link>
        </div>
      </header>

      <div style={{ flex: 1, maxWidth: 980, width: '100%', margin: '0 auto', padding: '44px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, alignItems: 'start' }}>
        <Frame className="strong" style={{ padding: 24 }}>
          <div className="kicker">Passwordless Client Access</div>
          <h1 style={{ margin: '4px 0 12px', font: '700 26px/1.1 var(--fh)', textTransform: 'uppercase' }}>
            Request Your Encrypted Member Sign-In Link
          </h1>
          <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--n6)', lineHeight: 1.55 }}>
            Member contacts never need a password. Enter the primary contact email address on file for your organization to receive a cryptographic magic link to view white-labeled inspection packets, complete your 30-Day Board Response Form, upload abatement proof photos, or sign a Risk Assumed statement.
          </p>
          {result?.error && <div className="banner warn" style={{ marginBottom: 12 }}>{result.error}</div>}
          {result?.message && (
            <div className="frame" style={{ padding: 14, marginBottom: 14, background: 'var(--a1)' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{result.message}</div>
              {result.demoPortalUrl && (
                <div style={{ marginTop: 8 }}>
                  <Link href={result.demoPortalUrl} className="btn btn-primary btn-sm">Open Demo Magic Link →</Link>
                </div>
              )}
            </div>
          )}
          <form onSubmit={requestLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label className="field">
              <span>Primary Member Contact Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="name@company.com"
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Sending magic link…' : 'Email My Sign-In Link'}
            </button>
          </form>
        </Frame>

        <Frame style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kicker">v0.0.3 Portal Security &amp; 30-Day Workflow</span>
            <Pill kind="verified">SHA-256 Tokenized</Pill>
          </div>
          <div style={{ fontSize: 13, color: 'var(--n7)', lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <strong>1. Zero-Enumeration Cryptographic Links:</strong> Raw member IDs and predictable URLs are strictly blocked. Magic links use 256-bit random tokens hashed at rest with SHA-256 and exchange into an HTTP-only session cookie.
            </div>
            <div>
              <strong>2. 30-Day Captive Board Response:</strong> Respond directly to numbered recommendations (<em>Agree</em>, <em>Disagree with Justification</em>, <em>Submit Abatement Photo</em>, or <em>Assume Risk in Writing</em>).
            </div>
            <div>
              <strong>3. Multi-Mode Report Archive:</strong> Access your organization&apos;s locked 7-year archive including Full Scorecards, ARU Visit Cover Letters, Photo Pages, and 30-Day Response Forms.
            </div>
          </div>
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--div2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="sub">Already signed in on this browser?</span>
            <Link href="/portal/session" className="btn btn-sm">Resume Active Portal Session →</Link>
          </div>
        </Frame>
      </div>
    </div>
  );
}
