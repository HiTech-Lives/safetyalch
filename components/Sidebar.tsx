'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Role, ImpersonationContext } from '@/lib/session';
import { APP_VERSION_TAG } from '@/lib/version';

type Props = {
  tenantId: string;
  tenantName: string;
  tenantLogo: string;
  workspaces: {
    platform: { id: string; role: string; name: string } | null;
    tenants: { user_id: string; role: string; tenant_id: string; tenant_name: string; accent: string }[];
  };
  role: Role;
  platformOnlyRole: string | null;
  isPlatformAdmin: boolean;
  canManageTeam: boolean;
  canManageBrand: boolean;
  canManageTaxonomy: boolean;
  canSeeBilling: boolean;
  impersonation: ImpersonationContext | null;
  user: { name: string; email: string; ini: string };
  overdue: number;
  demoSwitch: boolean;
};

export default function Sidebar({
  tenantId,
  tenantName,
  tenantLogo,
  workspaces,
  role,
  platformOnlyRole,
  isPlatformAdmin,
  canManageTeam,
  canManageBrand,
  canManageTaxonomy,
  canSeeBilling,
  impersonation,
  user,
  overdue,
  demoSwitch,
}: Props) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fontScale, setFontScale] = useState<'sm' | 'md' | 'lg'>('md');

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem('sa_font_scale')) as 'sm' | 'md' | 'lg' | null;
    const initial = saved && ['sm', 'md', 'lg'].includes(saved) ? saved : 'md';
    setFontScale(initial);
    document.documentElement.setAttribute('data-font-scale', initial);
  }, []);

  function updateFontScale(next: 'sm' | 'md' | 'lg') {
    setFontScale(next);
    document.documentElement.setAttribute('data-font-scale', next);
    localStorage.setItem('sa_font_scale', next);
  }

  const isPlatformOnly = tenantId === '__platform__';

  const accountItems: [string, string][] = [];
  if (canManageTaxonomy) accountItems.push(['/settings/taxonomy', 'Groups, Industries & Hierarchy']);
  if (canManageBrand) {
    accountItems.push(['/brand', 'Brand, Domain & SSO']);
    accountItems.push(['/settings/ai', 'AI & Model Routing']);
  }
  if (canSeeBilling) accountItems.push(['/billing', 'Billing & Seats']);

  const groups: [string, [string, string][]][] = isPlatformOnly
    ? [
        [
          'Platform Control Plane',
          [
            ['/platform', 'Tenants, Operators & ACLs'],
            ['/forms', 'Master Forms & Policies'],
            ['/regulations', '56-State Regulation Engine'],
          ],
        ],
      ]
    : [
        [
          'Loss Control & Dispatch',
          [
            ['/work-queue', 'Work Queue'],
            ['/engagements', 'Engagements & budgets'],
            ['/assignments', 'Assignments & certs'],
            ['/observations', 'Observations'],
            ['/timesheets', 'Timesheets & billing'],
          ],
        ],
        [
          'Inspections & Compliance',
          [
            ['/today', 'Today'],
            ['/schedule', 'Schedule'],
            ['/inspections', 'Inspections & Reports'],
            ['/recommendations', 'Recommendations'],
          ],
        ],
        [
          'People & Library',
          [
            ['/members', 'Members & Sites'],
            ...(canManageTeam ? ([['/team', 'Team & User ACLs']] as [string, string][]) : []),
            ['/forms', 'Forms & Written Policies'],
            ['/regulations', '56-State Regulations'],
          ],
        ],
        ...(accountItems.length ? ([['Workspace Settings', accountItems]] as [string, [string, string][]][]) : []),
        ...(isPlatformAdmin ? ([['SaaS Control Plane', [['/platform', 'Platform Console']]]] as [string, [string, string][]][]) : []),
      ];

  async function handleWorkspaceSwitch(val: string) {
    if (!val) return;
    const payload =
      val === '__platform__'
        ? { action: 'switch_workspace', target: 'platform' }
        : { action: 'switch_workspace', tenantId: val };
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (res.ok && body.redirectTo) {
      router.push(body.redirectTo);
      router.refresh();
    }
  }

  async function exitSupportSession() {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'exit_impersonation' }),
    });
    const body = await res.json();
    router.push(body.redirectTo || '/platform');
    router.refresh();
  }

  async function signOut() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.push('/login');
    router.refresh();
  }

  async function demoSwitchRole(nextRole: string) {
    await fetch('/api/demo-role', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId, role: nextRole }),
    });
    router.refresh();
  }

  const totalWorkspaces = (workspaces.platform ? 1 : 0) + workspaces.tenants.length;

  return (
    <>
      {impersonation && (
        <div
          className="imp-banner no-print"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 65 }}
        >
          <div>
            <strong>AUDITED SUPPORT SESSION ACTIVE</strong> · Operator: {impersonation.platformEmail} · Workspace:{' '}
            <strong>{tenantName}</strong> · Reason: &ldquo;{impersonation.reason}&rdquo; · Expires {impersonation.expiresAt} UTC
          </div>
          <button type="button" className="btn btn-sm" onClick={exitSupportSession}>
            Exit Support Session →
          </button>
        </div>
      )}

      <div className="mbar" style={impersonation ? { marginTop: 44 } : undefined}>
        <button aria-label="Menu" onClick={() => setOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span style={{ font: '700 15px var(--fh)', letterSpacing: '.05em', textTransform: 'uppercase' }}>{tenantName}</span>
      </div>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={'side' + (open ? ' open' : '')} style={impersonation ? { paddingTop: 44 } : undefined}>
        <div className="side-brand">
          <Link
            href={isPlatformOnly ? '/platform' : '/today'}
            aria-label={tenantName}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, color: '#fff', minWidth: 0 }}
          >
            {tenantLogo && (tenantLogo !== '/brand/logo.png' || isPlatformOnly || tenantId === 't1' || tenantName === 'The Safety Alchemist') ? (
              <img
                src={tenantLogo}
                alt={tenantName}
                style={tenantLogo === '/brand/logo.png' ? { filter: 'brightness(0) invert(1)', maxHeight: 28 } : { filter: 'none', maxHeight: 30 }}
              />
            ) : (
              <div style={{ font: '700 15px/1.1 var(--fh)', letterSpacing: '.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {tenantName}
              </div>
            )}
            <span className="kicker" style={{ color: 'rgba(255,255,255,.5)' }}>
              {isPlatformOnly ? 'Platform Plane' : 'Team Workspace'} · {APP_VERSION_TAG}
            </span>
          </Link>
        </div>

        {/* Unified SSO Workspace Switcher (scoped strictly to user's verified memberships) */}
        {totalWorkspaces > 1 && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <div className="kicker" style={{ color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>Switch Plane / Workspace</div>
            <select
              value={path.startsWith('/platform') ? '__platform__' : tenantId}
              onChange={e => handleWorkspaceSwitch(e.target.value)}
              aria-label="Workspace Switcher"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,.08)',
                border: '1px solid rgba(255,255,255,.25)',
                color: '#fff',
                font: '600 10.5px var(--mono)',
                padding: '5px 6px',
              }}
            >
              {workspaces.platform && (
                <option value="__platform__" style={{ color: '#241f1c' }}>
                  ★ PLATFORM CONSOLE (/platform)
                </option>
              )}
              {workspaces.tenants.map(w => (
                <option key={w.tenant_id} value={w.tenant_id} style={{ color: '#241f1c' }}>
                  {w.tenant_name.toUpperCase()} ({w.role.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        )}

        <nav>
          {groups.map(([g, items]) => (
            <div key={g}>
              <div className="nav-group">{g.toUpperCase()}</div>
              {items.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={'nav-item' + (path === href || (href !== '/today' && path.startsWith(href)) ? ' on' : '')}
                >
                  {label}
                  {href === '/recommendations' && overdue > 0 && <span className="nav-count">{overdue}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {!isPlatformOnly && (
          <div className="side-note" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="kicker" style={{ color: 'rgba(255,255,255,.45)' }}>Field &amp; External Surfaces</div>
            <Link href="/field/route" style={{ color: 'var(--sand)', fontWeight: 600, fontSize: 12 }}>
              Inspector Route &amp; Quick Capture →
            </Link>
            <Link href="/field" style={{ color: 'rgba(255,255,255,.85)', fontSize: 12 }}>
              Field Assessments &amp; Scorecards →
            </Link>
            <Link href="/portal" style={{ color: 'rgba(255,255,255,.8)', fontSize: 12 }}>
              Member Client Portal ↗
            </Link>
          </div>
        )}

        {/* Font Scale Accessibility Bar */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="kicker" style={{ color: 'rgba(255,255,255,.5)' }}>Text Size</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['sm', 'md', 'lg'] as const).map(sz => (
              <button
                key={sz}
                type="button"
                onClick={() => updateFontScale(sz)}
                style={{
                  padding: '2px 7px',
                  font: '600 10px var(--mono)',
                  background: fontScale === sz ? 'var(--sand)' : 'transparent',
                  color: fontScale === sz ? 'var(--ink)' : 'rgba(255,255,255,.75)',
                  border: '1px solid rgba(255,255,255,.25)',
                  cursor: 'pointer',
                }}
              >
                {sz === 'sm' ? 'A-' : sz === 'md' ? 'A' : 'A+'}
              </button>
            ))}
          </div>
        </div>

        <div className="side-user" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="avatar sand">{user.ini}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name}
              </div>
              <div className="kicker" style={{ color: 'rgba(255,255,255,.55)' }}>
                {platformOnlyRole || role}
              </div>
            </div>
            <button
              type="button"
              onClick={signOut}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,.25)',
                color: 'rgba(255,255,255,.8)',
                padding: '3px 7px',
                font: '600 9.5px var(--mono)',
                cursor: 'pointer',
              }}
            >
              SIGN OUT
            </button>
          </div>
          {demoSwitch && !isPlatformOnly && (
            <select
              value={role}
              onChange={e => demoSwitchRole(e.target.value)}
              aria-label="Demo role"
              style={{ width: '100%' }}
            >
              <option value="owner">DEMO ROLE: OWNER</option>
              <option value="admin">DEMO ROLE: TEAM ADMIN</option>
              <option value="supervisor">DEMO ROLE: SUPERVISOR</option>
              <option value="consultant">DEMO ROLE: CONSULTANT</option>
            </select>
          )}
        </div>
      </aside>
    </>
  );
}
