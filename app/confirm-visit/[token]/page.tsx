import VisitConfirmClient from '@/components/VisitConfirmClient';
import { one } from '@/lib/db';
import { guardAccent } from '@/lib/color';

export const dynamic = 'force-dynamic';

export default async function ConfirmVisitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const visit = await one<any>(
    `SELECT v.*,
            m.name AS member_name,
            st.name AS site_name, st.address AS site_address,
            f.name AS form_name,
            u.name AS consultant_name,
            t.name AS tenant_name, t.logo_key, t.accent
       FROM visits v
       JOIN sites st ON st.id = v.site_id
       JOIN members m ON m.id = st.member_id
       JOIN forms f ON f.code = v.form_code
       JOIN tenants t ON t.id = v.tenant_id
       LEFT JOIN users u ON u.id = v.lead_user_id
      WHERE v.confirm_token = ?`,
    [token]
  );

  if (!visit) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '60px 24px', textAlign: 'center' }}>
        <h1 style={{ font: '700 28px var(--fh)', textTransform: 'uppercase' }}>Visit Confirmation Link Not Found</h1>
        <p className="muted">Please check the confirmation link in your email or contact your loss control representative.</p>
      </div>
    );
  }

  const accent = guardAccent(visit.accent || '#4b2454');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', ['--acc' as string]: accent }}>
      <header style={{ background: 'var(--ink)', color: '#fff', padding: '16px 24px', marginBottom: 32 }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src={visit.logo_key || '/brand/logo.png'}
            alt={visit.tenant_name}
            style={{ height: 28, filter: 'brightness(0) invert(1)' }}
          />
          <div>
            <div style={{ font: '700 16px var(--fh)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
              {visit.tenant_name}
            </div>
            <div className="kicker" style={{ color: 'rgba(255,255,255,.55)' }}>
              Site Visit Confirmation Service
            </div>
          </div>
        </div>
      </header>

      <main style={{ padding: '0 24px 64px' }}>
        <VisitConfirmClient visit={visit} />
      </main>
    </div>
  );
}

