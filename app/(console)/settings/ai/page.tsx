import { PageHeader, Frame } from '@/components/ui';
import AISettingsManager from '@/components/AISettingsManager';
import { getSession, can } from '@/lib/session';
import { getTenant } from '@/lib/queries';
import { resolveAIConfig, maskAIConfigForClient } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export default async function AISettingsPage() {
  const s = await getSession();
  const canEdit = can.manageBrand(s);
  if (!canEdit && s.role !== 'supervisor' && s.role !== 'underwriting') {
    return (
      <>
        <PageHeader
          title="AI & Model Routing"
          subtitle="Workspace AI provider routing and encrypted credential vault"
        />
        <div className="content">
          <Frame style={{ padding: 20 }}>
            <div className="kicker">Restricted Access</div>
            <h2 style={{ margin: '6px 0 8px' }}>Brand &amp; AI Settings Permission Required</h2>
            <p className="note">
              Ask a Workspace Owner or Team Admin with <code>team:brand.manage</code> to update AI model routing or
              encrypted provider API keys.
            </p>
          </Frame>
        </div>
      </>
    );
  }

  const tenant = await getTenant(s);
  const maskedConfig = maskAIConfigForClient(resolveAIConfig(tenant.ai_config_json, tenant.ai_credentials_enc));

  return (
    <>
      <PageHeader
        title="AI & Model Routing"
        subtitle="Route each workflow need independently while keeping cloud provider API keys AES-256-GCM encrypted at rest"
      />
      <div className="content">
        <AISettingsManager initialConfig={maskedConfig} canEdit={canEdit} />
      </div>
    </>
  );
}
