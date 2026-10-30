import { PageHeader } from '@/components/ui';
import AISettingsManager from '@/components/AISettingsManager';
import { getSession } from '@/lib/session';
import { getTenant } from '@/lib/queries';
import { resolveAIConfig } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export default async function AISettingsPage() {
  const s = await getSession();
  const tenant = await getTenant(s);
  const config = resolveAIConfig(tenant.ai_config_json);
  const canEdit = s.role === 'owner' || s.role === 'admin';

  return (
    <>
      <PageHeader
        title="AI & Model Routing"
        subtitle="Route each workflow need (Email Intake, Quick Reports, Photo Vision, Receipt OCR, and Voice STT/TTS) to AWS Bedrock, ElevenLabs, Azure AI Foundry, or OpenAI"
      />
      <div className="content">
        <AISettingsManager initialConfig={config} canEdit={canEdit} />
      </div>
    </>
  );
}

