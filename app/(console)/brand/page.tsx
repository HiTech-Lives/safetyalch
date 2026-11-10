import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import BrandForm from '@/components/BrandForm';
import { getSession, can } from '@/lib/session';
import { getTenant } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function BrandPage() {
  const s = await getSession();
  if (!can.manageBrand(s)) redirect('/today');
  const t = await getTenant(s);
  const sso = t.sso_config_json || {};
  return (
    <>
      <PageHeader
        title="Brand, White-Label & Enterprise SSO"
        subtitle="Configure tenant identity, verified email sender protection, raster brand logos, and OIDC / SAML single sign-on"
      />
      <div className="content">
        <BrandForm
          tenant={{
            name: t.name,
            domain: t.custom_domain ?? '',
            sender: t.email_sender ?? '',
            senderVerified: Boolean(t.email_sender_verified),
            accent: t.accent,
            logo: t.logo_key ?? '',
            scopes: t.brand_scopes,
            ssoConfig: {
              enabled: Boolean(sso.enabled),
              providerName: sso.providerName || 'Enterprise OIDC / SAML SSO',
              issuerUrl: sso.issuerUrl || '',
              clientId: sso.clientId || '',
              authorizationUrl: sso.authorizationUrl || '',
            },
          }}
          portalPreviewHref="/portal"
        />
      </div>
    </>
  );
}
