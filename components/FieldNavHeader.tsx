'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function FieldNavHeader({
  tenantName,
  logoUrl,
  userName,
  role,
}: {
  tenantName: string;
  logoUrl: string;
  userName: string;
  role: string;
}) {
  const path = usePathname();
  const tabs = [
    { href: '/field/route', label: 'My Route' },
    { href: '/field/capture', label: 'AI Quick Capture' },
    { href: '/field/quick-report', label: 'AI Quick Report' },
    { href: '/field', label: '15-Form Checklists' },
    { href: '/field/jobs', label: 'My Jobs · Time · Expenses' },
  ];

  return (
    <header
      style={{
        background: 'var(--ink)',
        color: '#fff',
        padding: '12px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderBottom: '2px solid var(--acc)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src={logoUrl || '/brand/logo.png'}
            alt={tenantName}
            style={logoUrl && logoUrl !== '/brand/logo.png' ? { height: 28 } : { height: 28, filter: 'brightness(0) invert(1)' }}
          />
          <div>
            <div style={{ font: '700 17px var(--fh)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
              {tenantName} · Field Loss Control PWA
            </div>
            <div className="kicker" style={{ color: 'rgba(255,255,255,.55)' }}>
              Consultant: {userName} ({role})
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            href="/work-queue"
            className="btn btn-sm"
            style={{ background: 'transparent', borderColor: 'rgba(255,255,255,.35)', color: '#fff' }}
          >
            ← Back to Office Console
          </Link>
        </div>
      </div>

      <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tabs.map(t => {
          const active = t.href === '/field' ? path === '/field' || /^\/field\/I-/.test(path) : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className="btn btn-sm"
              style={{
                background: active ? 'var(--acc)' : 'rgba(255,255,255,.08)',
                borderColor: active ? 'var(--acc)' : 'rgba(255,255,255,.2)',
                color: '#fff',
                fontWeight: active ? 700 : 500,
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

