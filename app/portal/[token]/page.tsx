import Link from 'next/link';
import { notFound } from 'next/navigation';
import PortalClientView from '@/components/PortalClientView';
import { q, one } from '@/lib/db';
import { hashToken } from '@/lib/auth';
import { guardAccent } from '@/lib/color';

export const dynamic = 'force-dynamic';

export default async function MemberPortalTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const th = hashToken(token);

  let ctx = await one<any>(
    `SELECT c.id AS contact_id, c.name AS contact_name, c.email AS contact_email,
            m.id AS member_id, m.name AS member_name, m.industry, m.city, m.tenant_id
       FROM magic_links ml
       JOIN member_contacts c ON c.id = ml.contact_id
       JOIN members m ON m.id = c.member_id
      WHERE ml.token_hash = ? AND ml.expires_at > NOW()
      LIMIT 1`,
    [th]
  );

  if (!ctx) {
    // Allow direct member ID preview (e.g. /portal/m1)
    ctx = await one<any>(
      `SELECT c.id AS contact_id, c.name AS contact_name, c.email AS contact_email,
              m.id AS member_id, m.name AS member_name, m.industry, m.city, m.tenant_id
         FROM member_contacts c
         JOIN members m ON m.id = c.member_id
        WHERE m.id = ? AND c.is_primary = 1
        LIMIT 1`,
      [token]
    );
  }

  if (!ctx) notFound();

  const tenant = await one<any>('SELECT * FROM tenants WHERE id=?', [ctx.tenant_id]);
  if (tenant && typeof tenant.brand_scopes === 'string') tenant.brand_scopes = JSON.parse(tenant.brand_scopes);

  const sites = await q<any>('SELECT * FROM sites WHERE member_id=? ORDER BY name', [ctx.member_id]);
  const recs = await q<any>(
    `SELECT r.*, st.name AS site_name, st.jurisdiction,
            g.code AS reg_code, g.title AS reg_title
       FROM recommendations r
       JOIN inspections i ON i.id = r.inspection_id
       JOIN sites st ON st.id = i.site_id
       LEFT JOIN regulations g ON g.reg_id = r.reg_id
      WHERE st.member_id = ?
      ORDER BY r.due_on, r.id`,
    [ctx.member_id]
  );
  const inspections = await q<any>(
    `SELECT i.id, i.started_at, i.submitted_at, i.form_code, f.name AS form_name, f.scale,
            st.name AS site_name, st.jurisdiction, u.name AS consultant
       FROM inspections i
       JOIN forms f ON f.code = i.form_code
       JOIN sites st ON st.id = i.site_id
       JOIN users u ON u.id = i.consultant_id
      WHERE st.member_id = ? AND i.submitted_at IS NOT NULL
      ORDER BY i.started_at DESC`,
    [ctx.member_id]
  );

  const accent = tenant?.brand_scopes?.portal ? guardAccent(tenant.accent) : '#4b2454';
  const logoSrc = tenant?.logo_key || '/brand/logo.png';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', ['--acc' as string]: accent }}>
      <header style={{ background: '#fff', borderBottom: '3px solid var(--acc)', padding: '16px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={logoSrc} alt={tenant.name} style={{ height: 34 }} />
            <div>
              <div style={{ font: '700 18px var(--fh)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--a7)' }}>
                {tenant.name}
              </div>
              <div className="kicker">{tenant.custom_domain || 'Member Safety & Compliance Portal'}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{ctx.member_name}</div>
            <div className="sub">Signed in as {ctx.contact_name} ({ctx.contact_email}) · <Link href="/portal">Switch Member</Link></div>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 960, width: '100%', margin: '0 auto', padding: '28px 24px 56px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PortalClientView
          token={token}
          tenant={tenant}
          member={{ id: ctx.member_id, name: ctx.member_name, industry: ctx.industry, city: ctx.city }}
          contact={{ id: ctx.contact_id, name: ctx.contact_name, email: ctx.contact_email }}
          sites={sites}
          recs={recs}
          inspections={inspections}
        />
      </main>
    </div>
  );
}

