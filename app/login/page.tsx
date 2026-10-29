'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from '@/components/ui';

const DEMO_ACCOUNTS = [
  { label: 'Dana Okafor · Owner + Platform Admin', org: 'The Safety Alchemist (t1)', email: 'dana@safetyalchemist.com', role: 'owner' },
  { label: 'Lena Chen · Back-Office Admin (Free Seat)', org: 'The Safety Alchemist (t1)', email: 'lena@safetyalchemist.com', role: 'admin' },
  { label: 'Jordan Boone · Crew Supervisor', org: 'The Safety Alchemist (t1)', email: 'jordan@safetyalchemist.com', role: 'supervisor' },
  { label: 'Mai Tran · Field Consultant', org: 'The Safety Alchemist (t1)', email: 'mai@safetyalchemist.com', role: 'consultant' },
  { label: 'Marcus Sterling · Tenant 2 Owner', org: 'Northwest Compliance Partners (t2)', email: 'marcus@nwcompliance.com', role: 'owner' },
  { label: 'Claire Lin · Tenant 2 Field Consultant', org: 'Northwest Compliance Partners (t2)', email: 'claire@nwcompliance.com', role: 'consultant' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('dana@safetyalchemist.com');
  const [password, setPassword] = useState('safetyalchemist');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(body.error || 'Sign-in failed');
      return;
    }
    router.push(body.redirectTo || '/today');
    router.refresh();
  }

  async function quickLogin(accEmail: string) {
    setEmail(accEmail);
    setPassword('safetyalchemist');
    setBusy(true);
    setErr(null);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'login', email: accEmail, password: 'safetyalchemist' }),
    });
    const body = await res.json();
    setBusy(false);
    if (res.ok) {
      router.push('/today');
      router.refresh();
    } else {
      setErr(body.error);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'var(--ink)', color: '#fff', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
          <img src="/brand/logo.png" alt="The Safety Alchemist" style={{ height: 28, filter: 'brightness(0) invert(1)' }} />
          <span style={{ font: '700 17px var(--fh)', letterSpacing: '.05em', textTransform: 'uppercase' }}>The Safety Alchemist</span>
        </Link>
        <div style={{ display: 'flex', gap: 12, fontSize: 12.5 }}>
          <Link href="/portal" style={{ color: 'rgba(255,255,255,.8)' }}>Member Client Portal →</Link>
          <Link href="/signup" style={{ color: 'var(--sand)', fontWeight: 600 }}>Create Consultancy Account →</Link>
        </div>
      </header>

      <div style={{ flex: 1, maxWidth: 980, width: '100%', margin: '0 auto', padding: '44px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, alignItems: 'start' }}>
        <Frame className="strong" style={{ padding: 24 }}>
          <div className="kicker">Staff &amp; Inspector Authentication</div>
          <h1 style={{ margin: '4px 0 14px', font: '700 26px/1.1 var(--fh)', textTransform: 'uppercase' }}>Sign In to Your Consultancy</h1>
          {err && <div className="banner warn" style={{ marginBottom: 14 }}>{err}</div>}
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="field">
              <span>Work Email</span>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </label>
            <label className="field">
              <span>Password</span>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign In to Console →'}
            </button>
          </form>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--div2)', fontSize: 12.5, color: 'var(--n6)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>Are you a Member client looking to submit a hazard correction? <Link href="/portal" style={{ fontWeight: 600 }}>Open the passwordless Member Portal →</Link></div>
            <div>Starting a new safety consultancy? <Link href="/signup" style={{ fontWeight: 600 }}>Provision a new tenant account →</Link></div>
          </div>
        </Frame>

        <Frame style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kicker">Multi-Tenant Demo Directory</span>
            <Pill kind="acc">1-Click Switch</Pill>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--n6)', lineHeight: 1.5 }}>
            Click any seeded account below to sign in immediately as that tenant and role (default password: <code>safetyalchemist</code>):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEMO_ACCOUNTS.map(a => (
              <button
                key={a.email}
                type="button"
                disabled={busy}
                onClick={() => quickLogin(a.email)}
                className="frame"
                style={{ padding: '10px 14px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</div>
                  <div className="sub">{a.org} · {a.email}</div>
                </div>
                <Pill kind="line">{a.role}</Pill>
              </button>
            ))}
          </div>
        </Frame>
      </div>
    </div>
  );
}

