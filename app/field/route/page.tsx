import FieldNavHeader from '@/components/FieldNavHeader';
import FieldRouteClient from '@/components/FieldRouteClient';
import { getSession } from '@/lib/session';
import { getTenant, listVisits } from '@/lib/queries';
import { guardAccent } from '@/lib/color';

export const dynamic = 'force-dynamic';

export default async function FieldRoutePage() {
  const s = await getSession();
  const [tenant, visits] = await Promise.all([getTenant(s), listVisits(s)]);
  const accent = tenant.brand_scopes?.app ? guardAccent(tenant.accent) : '#4b2454';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', ['--acc' as string]: accent }}>
      <FieldNavHeader
        tenantName={tenant.name}
        logoUrl={tenant.logo_key || '/brand/logo.png'}
        userName={s.user.name}
        role={s.role}
      />
      <main style={{ flex: 1, maxWidth: 1120, width: '100%', margin: '0 auto', padding: '26px 24px 56px' }}>
        <div style={{ marginBottom: 18 }}>
          <div className="kicker">Mobile Inspector Route &amp; Confirmation</div>
          <h1 style={{ font: '700 28px var(--fh)', textTransform: 'uppercase', margin: '4px 0 0' }}>
            Today&rsquo;s Route &amp; Site Confirmations
          </h1>
        </div>
        <FieldRouteClient visits={visits} />
      </main>
    </div>
  );
}

