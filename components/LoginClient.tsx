'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from '@/components/ui';
import { APP_VERSION_TAG } from '@/lib/version';

const DEMO_PLATFORM_OPERATORS = [
  { label: 'Platform Root Super-Admin (Control Plane Only)', org: 'SaaS Platform (/platform)', email: 'platform@safetyalchemist.com', role: 'platform_super_admin' },
  { label: 'Master Compliance Editor (56-State & Master Forms)', org: 'SaaS Platform (/platform)', email: 'compliance@safetyalchemist.com', role: 'platform_compliance_editor' },
  { label: 'Platform Ops Admin (Tenants & Support)', org: 'SaaS Platform (/platform)', email: 'ops@safetyalchemist.com', role: 'platform_ops_admin' },
];

const DEMO_TEAM_ACCOUNTS = [
  { label: 'Dana Okafor · Dual-Plane (Platform + t1 Owner)', org: 'The Safety Alchemist (t1 — Breckpoint Gems)', userId: 'u1', email: 'dana@safetyalchemist.com', role: 'owner' },
  { label: 'Lena Chen · Team Admin (Complimentary Seat)', org: 'The Safety Alchemist (t1)', userId: 'u3', email: 'lena@safetyalchemist.com', role: 'admin' },
  { label: 'Jordan Boone · Crew Supervisor', org: 'The Safety Alchemist (t1)', userId: 'u4', email: 'jordan@safetyalchemist.com', role: 'supervisor' },
  { label: 'Mai Tran · Field Consultant', org: 'The Safety Alchemist (t1)', userId: 'u5', email: 'mai@safetyalchemist.com', role: 'consultant' },
  { label: 'Marcus Sterling · Tenant 2 Owner', org: 'Northwest Compliance Partners (t2)', userId: 'u20', email: 'marcus@nwcompliance.com', role: 'owner' },
];

export default function LoginClient({
  demoMode,
  nextPath,
}: {
  demoMode: boolean;
  nextPath?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ssoMode, setSsoMode] = useState(false);
  const [ssoInfo, setSsoInfo] = useState<{
    ssoAvailable: boolean;
    providerName?: string;
    tenantName?: string;
    authorizationUrl?: string | null;
  } | null>(null);
  const [workspaces, setWorkspaces] = useState<{
    platform: { id: string; name: string; role: string } | null;
    tenants: { tenantId: string; tenantName: string; role: string; accent: string }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSsoDiscovery(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'sso_lookup', email }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(body.error || 'SSO lookup failed.');
      return;
    }
    setSsoInfo(body);
    if (body.ssoAvailable && body.authorizationUrl) {
      window.location.href = body.authorizationUrl;
      return;
    }
    if (!body.ssoAvailable) {
      setSsoMode(false);
      setErr('Enterprise OIDC/SAML SSO is not enabled for this email domain. Sign in with your workspace password below.');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password, next: nextPath }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(body.error || 'Sign-in failed');
      return;
    }

    const totalTargets = (body.workspaces?.platform ? 1 : 0) + (body.workspaces?.tenants?.length || 0);
    if (totalTargets > 1 && !nextPath) {
      setWorkspaces(body.workspaces);
      return;
    }

    router.push(body.redirectTo || '/today');
    router.refresh();
  }

  async function chooseWorkspace(target: 'platform' | string) {
    setBusy(true);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        target === 'platform'
          ? { action: 'switch_workspace', target: 'platform' }
          : { action: 'switch_workspace', tenantId: target }
      ),
    });
    const body = await res.json();
    setBusy(false);
    if (res.ok) {
      router.push(body.redirectTo || '/today');
      router.refresh();
    } else {
      setErr(body.error || 'Could not open workspace.');
    }
  }

  async function demoSignIn(payload: { platformEmail?: string; userId?: string }) {
    setBusy(true);
    setErr(null);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'demo_login', ...payload }),
    });
    const body = await res.json();
    setBusy(false);
    if (res.ok) {
      router.push(body.redirectTo || '/today');
      router.refresh();
    } else {
      setErr(body.error || 'Demo sign-in unavailable.');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'var(--ink)', color: '#fff', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" aria-label="The Safety Alchemist Home" style={{ display: 'flex', alignItems: 'center', color: '#fff' }}>
          <img src="/brand/logo.png" alt="The Safety Alchemist" style={{ height: 30, filter: 'brightness(0) invert(1)' }} />
        </Link>
        <div style={{ display: 'flex', gap: 14, fontSize: 12.5 }}>
          <Link href="/portal" style={{ color: 'rgba(255,255,255,.8)' }}>Member Client Portal →</Link>
          <Link href="/signup" style={{ color: 'var(--sand)', fontWeight: 600 }}>Create Consultancy Account →</Link>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          maxWidth: demoMode ? 980 : 500,
          width: '100%',
          margin: '0 auto',
          padding: '44px 24px',
          display: 'grid',
          gridTemplateColumns: demoMode ? 'repeat(auto-fit, minmax(340px, 1fr))' : 'minmax(0, 1fr)',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <Frame className="strong" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div className="kicker">Unified SSO Single Entry Point</div>
            <Pill kind="ink">{APP_VERSION_TAG} Dual-Plane RBAC</Pill>
          </div>
          <h1 style={{ margin: '6px 0 14px', font: '700 26px/1.1 var(--fh)', textTransform: 'uppercase' }}>
            {workspaces ? 'Select Destination Plane' : 'Sign In to Safety Alchemist'}
          </h1>

          {err && <div className="banner warn" style={{ marginBottom: 14 }}>{err}</div>}

          {workspaces ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, color: 'var(--n7)', marginBottom: 4 }}>
                Your identity (<strong>{email}</strong>) is authorized across multiple planes. Choose where to enter:
              </div>
              {workspaces.platform && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => chooseWorkspace('platform')}
                  className="frame strong"
                  style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>SaaS Platform Control Plane (/platform)</div>
                    <div className="sub">Operator Role: {workspaces.platform.role} · Separate Platform ACL</div>
                  </div>
                  <Pill kind="solid">Platform</Pill>
                </button>
              )}
              {workspaces.tenants.map(w => (
                <button
                  key={w.tenantId}
                  type="button"
                  disabled={busy}
                  onClick={() => chooseWorkspace(w.tenantId)}
                  className="frame"
                  style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 12, height: 12, background: w.accent || '#4b2454', border: '1px solid var(--ink)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{w.tenantName}</div>
                      <div className="sub">Team Workspace ({w.tenantId}) · Role: {w.role}</div>
                    </div>
                  </div>
                  <Pill kind="acc">{w.role}</Pill>
                </button>
              ))}
            </div>
          ) : ssoMode ? (
            <form onSubmit={handleSsoDiscovery} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className="field">
                <span>Corporate / Captive Email</span>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="inspector@yourfirm.com"
                  required
                />
              </label>
              {ssoInfo?.ssoAvailable && !ssoInfo.authorizationUrl && (
                <div className="banner dashed">
                  SSO Provider <strong>{ssoInfo.providerName}</strong> is registered for {ssoInfo.tenantName}. Complete OIDC callback URL in Brand Settings or sign in with password.
                </div>
              )}
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Checking Domain SSO…' : 'Continue with Enterprise SSO →'}
              </button>
              <button type="button" className="btn" onClick={() => setSsoMode(false)}>
                ← Use Email &amp; Password Instead
              </button>
            </form>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className="field">
                <span>Work Email (Team Workspace or Platform Operator)</span>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@organization.com"
                  autoComplete="username"
                  required
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Authenticating…' : 'Sign In →'}
              </button>
              <button type="button" className="btn" onClick={() => setSsoMode(true)}>
                Sign In with Enterprise OIDC / SAML SSO
              </button>
            </form>
          )}

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--div2)', fontSize: 12.5, color: 'var(--n6)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              Member client responding to a 30-day board notice or hazard correction?{' '}
              <Link href="/portal" style={{ fontWeight: 600 }}>Open the passwordless Member Portal →</Link>
            </div>
            <div>
              Launching a new safety consultancy or captive?{' '}
              <Link href="/signup" style={{ fontWeight: 600 }}>Provision a new workspace →</Link>
            </div>
          </div>
        </Frame>

        {demoMode && (
          <Frame style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="kicker">Sandbox Demo Directory (ENABLE_DEMO_MODE=true)</span>
              <Pill kind="acc">Dual-Plane</Pill>
            </div>
            <div style={{ fontSize: 12, color: 'var(--n6)', lineHeight: 1.45 }}>
              Platform Admins and Team Admins are strictly isolated in separate session &amp; ACL tables:
            </div>

            <div className="kicker" style={{ marginTop: 4 }}>Plane 1 · Platform Operators (/platform)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DEMO_PLATFORM_OPERATORS.map(op => (
                <button
                  key={op.email}
                  type="button"
                  disabled={busy}
                  onClick={() => demoSignIn({ platformEmail: op.email })}
                  className="frame strong"
                  style={{ padding: '9px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>{op.label}</div>
                    <div className="sub">{op.email}</div>
                  </div>
                  <Pill kind="solid">Platform</Pill>
                </button>
              ))}
            </div>

            <div className="kicker" style={{ marginTop: 6 }}>Plane 2 · Tenant Workspaces (/today &amp; /team)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DEMO_TEAM_ACCOUNTS.map(a => (
                <button
                  key={a.userId}
                  type="button"
                  disabled={busy}
                  onClick={() => demoSignIn({ userId: a.userId })}
                  className="frame"
                  style={{ padding: '9px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>{a.label}</div>
                    <div className="sub">{a.org} · {a.email}</div>
                  </div>
                  <Pill kind="line">{a.role}</Pill>
                </button>
              ))}
            </div>
          </Frame>
        )}
      </div>
    </div>
  );
}

