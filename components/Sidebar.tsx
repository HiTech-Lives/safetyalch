'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Role } from '@/lib/session';

type Props = {
  tenantId: string;
  tenantName: string;
  tenantLogo: string;
  tenants: { id: string; name: string }[];
  role: Role;
  isPlatformAdmin: boolean;
  user: { name: string; ini: string };
  overdue: number;
  demoSwitch: boolean;
};

export default function Sidebar({
  tenantId,
  tenantName,
  tenantLogo,
  tenants,
  role,
  isPlatformAdmin,
  user,
  overdue,
  demoSwitch,
}: Props) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const staff = role === 'owner' || role === 'admin';
  const groups: [string, [string, string][]][] = [
    ['Operations', [['/today', 'Today'], ['/schedule', 'Schedule'], ['/inspections', 'Inspections'], ['/recommendations', 'Recommendations']]],
    ['People', [['/members', 'Members & sites'], ...(staff ? ([['/team', 'Team']] as [string, string][]) : [])]],
    ['Library', [['/forms', 'Forms'], ['/regulations', 'Regulations']]],
    ...(staff ? ([['Account', [['/brand', 'Brand & white-label'], ['/billing', 'Billing & seats']]]] as [string, [string, string][]][]) : []),
    ...(isPlatformAdmin ? ([['SaaS Operator', [['/platform', 'Platform Super-Admin']]]] as [string, [string, string][]][]) : []),
  ];

  async function switchContext(next: { role?: string; tenantId?: string }) {
    await fetch('/api/demo-role', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    });
    router.refresh();
  }

  return (
    <>
      <div className="mbar">
        <button aria-label="Menu" onClick={() => setOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span style={{ font: '700 15px var(--fh)', letterSpacing: '.05em', textTransform: 'uppercase' }}>{tenantName}</span>
      </div>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="side-brand">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff', minWidth: 0 }}>
            <img src={tenantLogo} alt={tenantName} style={tenantLogo === '/brand/logo.png' ? { filter: 'brightness(0) invert(1)' } : { filter: 'none', maxHeight: 28 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ font: '700 13px/1.1 var(--fh)', letterSpacing: '.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tenantName}
              </div>
              <span className="kicker" style={{ color: 'rgba(255,255,255,.5)' }}>Console</span>
            </div>
          </Link>
        </div>
        <nav>
          {groups.map(([g, items]) => (
            <div key={g}>
              <div className="nav-group">{g.toUpperCase()}</div>
              {items.map(([href, label]) => (
                <Link key={href} href={href} onClick={() => setOpen(false)} className={'nav-item' + (path.startsWith(href) ? ' on' : '')}>
                  {label}
                  {href === '/recommendations' && overdue > 0 && <span className="nav-count">{overdue}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Connected Platform Surfaces */}
        <div className="side-note" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="kicker" style={{ color: 'rgba(255,255,255,.45)' }}>Connected Surfaces</div>
          <Link href="/field" style={{ color: 'var(--sand)', fontWeight: 600, fontSize: 12 }}>
            Launch Field Inspector App →
          </Link>
          <Link href="/portal" style={{ color: 'rgba(255,255,255,.8)', fontSize: 12 }}>
            Member Client Portal ↗
          </Link>
          <Link href="/" style={{ color: 'rgba(255,255,255,.65)', fontSize: 11.5 }}>
            Public Website &amp; Pricing ↗
          </Link>
        </div>

        <div className="side-user" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="avatar sand">{user.ini}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
              <div className="kicker" style={{ color: 'rgba(255,255,255,.55)' }}>{role}</div>
            </div>
            <Link href="/login" style={{ fontSize: 10.5, color: 'rgba(255,255,255,.55)', fontFamily: 'var(--mono)' }}>
              SWITCH
            </Link>
          </div>
          {demoSwitch && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <select
                value={tenantId}
                onChange={e => switchContext({ tenantId: e.target.value })}
                aria-label="Demo tenant"
                style={{ width: '100%' }}
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>TENANT: {t.name.toUpperCase()}</option>
                ))}
              </select>
              <select
                value={role}
                onChange={e => switchContext({ role: e.target.value })}
                aria-label="Demo role"
                style={{ width: '100%' }}
              >
                <option value="owner">ROLE: OWNER (PAID SEAT)</option>
                <option value="admin">ROLE: ADMIN (FREE SEAT)</option>
                <option value="supervisor">ROLE: SUPERVISOR (CREW)</option>
                <option value="consultant">ROLE: CONSULTANT (FIELD)</option>
              </select>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
