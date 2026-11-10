'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AI_PROVIDER_CATALOG,
  AI_NEEDS_METADATA,
  AIConfig,
  AINeedKey,
  AINeedRoute,
  AIProviderId,
  ELEVENLABS_VOICES,
  getModelsForProviderAndModality,
} from '@/lib/ai-catalog';
import { Frame, Pill } from '@/components/ui';

const PROVIDER_SHORT_LABELS: Record<AIProviderId, string> = {
  aws_bedrock: 'AWS Bedrock',
  elevenlabs: 'ElevenLabs Voice AI',
  azure_ai: 'Azure AI Foundry',
  openai_compat: 'OpenAI / Self-Hosted vLLM',
  gemini: 'Google Gemini API',
  anthropic: 'Anthropic Claude API',
  deterministic: 'Local Rule Engine ($0)',
};

export default function AISettingsManager({
  initialConfig,
  canEdit = true,
}: {
  initialConfig: AIConfig & { maskedSecrets?: Record<string, string> };
  canEdit?: boolean;
}) {
  const router = useRouter();
  const masked = initialConfig.maskedSecrets || {};

  const [routes, setRoutes] = useState<Record<AINeedKey, AINeedRoute>>(
    initialConfig.routes || {
      email: { provider: initialConfig.provider || 'aws_bedrock', model: initialConfig.textModel || 'qwen.qwen2.5-32b-instruct-v1:0' },
      report: { provider: initialConfig.provider || 'aws_bedrock', model: initialConfig.textModel || 'qwen.qwen2.5-32b-instruct-v1:0' },
      vision: { provider: initialConfig.provider || 'aws_bedrock', model: initialConfig.visionModel || 'qwen.qwen2.5-vl-72b-instruct' },
      ocr: { provider: initialConfig.provider || 'aws_bedrock', model: initialConfig.visionModel || 'qwen.qwen2.5-vl-72b-instruct' },
      stt: { provider: 'elevenlabs', model: 'scribe_v1' },
      tts: { provider: 'elevenlabs', model: 'eleven_flash_v2_5' },
    }
  );

  const [customModelMode, setCustomModelMode] = useState<Record<AINeedKey, boolean>>({
    email: false,
    report: false,
    vision: false,
    ocr: false,
    stt: false,
    tts: false,
  });

  // Cloud Endpoint & Credentials State (raw secrets are NEVER hydrated to browser; inputs start empty!)
  const [credTab, setCredTab] = useState<'aws_bedrock' | 'elevenlabs' | 'azure_ai' | 'openai_compat'>('aws_bedrock');
  const [awsRegion, setAwsRegion] = useState(initialConfig.awsRegion || 'us-west-2');
  const [awsBedrockEndpoint, setAwsBedrockEndpoint] = useState(initialConfig.awsBedrockEndpoint || '');
  const [awsBedrockApiKey, setAwsBedrockApiKey] = useState('');

  const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState(initialConfig.elevenlabsVoiceId || 'JBFqnCBsd6RMkjVDRZzb');

  const [azureEndpoint, setAzureEndpoint] = useState(initialConfig.azureEndpoint || '');
  const [azureApiKey, setAzureApiKey] = useState('');
  const [azureApiVersion, setAzureApiVersion] = useState(initialConfig.azureApiVersion || '2024-05-01-preview');

  const [openaiBaseUrl, setOpenaiBaseUrl] = useState(initialConfig.openaiBaseUrl || '');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [clearSecrets, setClearSecrets] = useState<string[]>([]);

  const [fallbackToDeterministic, setFallbackToDeterministic] = useState(
    initialConfig.fallbackToDeterministic !== false
  );

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Live Test Bench State
  const [testingNeed, setTestingNeed] = useState<string | null>(null);
  const [testOutput, setTestOutput] = useState<any>(null);

  function secretPlaceholder(key: string, defaultText: string) {
    if (clearSecrets.includes(key)) return 'Will clear saved key on Save…';
    if (masked[key]) return `Saved encrypted (${masked[key]}) — leave blank to keep`;
    return defaultText;
  }

  function toggleClearSecret(key: string) {
    setClearSecrets(prev => (prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]));
  }

  function handleProviderChange(
    needKey: AINeedKey,
    modality: 'text' | 'vision' | 'stt' | 'tts',
    nextProvider: AIProviderId
  ) {
    const models = getModelsForProviderAndModality(nextProvider, modality);
    const defaultModel = models[0]?.id || 'tsa-deterministic-v2';
    setRoutes(prev => ({
      ...prev,
      [needKey]: {
        provider: nextProvider,
        model: defaultModel,
      },
    }));
    if (
      nextProvider === 'aws_bedrock' ||
      nextProvider === 'elevenlabs' ||
      nextProvider === 'azure_ai' ||
      nextProvider === 'openai_compat'
    ) {
      setCredTab(nextProvider);
    }
  }

  function handleModelChange(needKey: AINeedKey, nextModel: string) {
    setRoutes(prev => ({
      ...prev,
      [needKey]: {
        ...prev[needKey],
        model: nextModel,
      },
    }));
  }

  function applyPreset(preset: 'aws_elevenlabs' | 'all_aws' | 'azure_elevenlabs' | 'local') {
    if (preset === 'aws_elevenlabs') {
      setRoutes({
        email: { provider: 'aws_bedrock', model: 'qwen.qwen2.5-32b-instruct-v1:0' },
        report: { provider: 'aws_bedrock', model: 'qwen.qwen2.5-32b-instruct-v1:0' },
        vision: { provider: 'aws_bedrock', model: 'qwen.qwen2.5-vl-72b-instruct' },
        ocr: { provider: 'aws_bedrock', model: 'qwen.qwen2.5-vl-72b-instruct' },
        stt: { provider: 'elevenlabs', model: 'scribe_v1' },
        tts: { provider: 'elevenlabs', model: 'eleven_flash_v2_5' },
      });
      setStatusMsg('Applied Preset: AWS Bedrock (Qwen 2.5) + ElevenLabs (Scribe v1 & Flash TTS)');
    } else if (preset === 'all_aws') {
      setRoutes({
        email: { provider: 'aws_bedrock', model: 'qwen.qwen2.5-32b-instruct-v1:0' },
        report: { provider: 'aws_bedrock', model: 'qwen.qwen2.5-32b-instruct-v1:0' },
        vision: { provider: 'aws_bedrock', model: 'qwen.qwen2.5-vl-72b-instruct' },
        ocr: { provider: 'aws_bedrock', model: 'qwen.qwen2.5-vl-72b-instruct' },
        stt: { provider: 'aws_bedrock', model: 'aws.transcribe-streaming' },
        tts: { provider: 'aws_bedrock', model: 'amazon.polly-neural-matthew' },
      });
      setStatusMsg('Applied Preset: 100% AWS Bedrock + AWS Transcribe/Polly');
    } else if (preset === 'azure_elevenlabs') {
      setRoutes({
        email: { provider: 'azure_ai', model: 'Qwen2.5-32B-Instruct' },
        report: { provider: 'azure_ai', model: 'Qwen2.5-32B-Instruct' },
        vision: { provider: 'azure_ai', model: 'Phi-4-multimodal-instruct' },
        ocr: { provider: 'azure_ai', model: 'Phi-4-multimodal-instruct' },
        stt: { provider: 'elevenlabs', model: 'scribe_v1' },
        tts: { provider: 'elevenlabs', model: 'eleven_flash_v2_5' },
      });
      setStatusMsg('Applied Preset: Azure AI Foundry + ElevenLabs Voice');
    } else {
      setRoutes({
        email: { provider: 'deterministic', model: 'tsa-deterministic-v2' },
        report: { provider: 'deterministic', model: 'tsa-deterministic-v2' },
        vision: { provider: 'deterministic', model: 'tsa-vision-heuristics-v2' },
        ocr: { provider: 'deterministic', model: 'tsa-vision-heuristics-v2' },
        stt: { provider: 'deterministic', model: 'tsa-speech-norm-v2' },
        tts: { provider: 'deterministic', model: 'browser-speech-synthesis' },
      });
      setStatusMsg('Applied Preset: 100% Local Zero-Cost Engine');
    }
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSaving(true);
    setStatusMsg('');
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'save_config',
        provider: routes.email.provider,
        routes,
        awsRegion,
        awsBedrockEndpoint,
        awsBedrockApiKey,
        elevenlabsApiKey,
        elevenlabsVoiceId,
        azureEndpoint,
        azureApiKey,
        azureApiVersion,
        azureModel: routes.email.model,
        openaiBaseUrl,
        openaiApiKey,
        clearSecrets,
        textModel: routes.email.model,
        visionModel: routes.vision.model,
        audioModel: routes.stt.model,
        fallbackToDeterministic,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setAwsBedrockApiKey('');
      setElevenlabsApiKey('');
      setAzureApiKey('');
      setOpenaiApiKey('');
      setClearSecrets([]);
      setStatusMsg('Encrypted AI Credentials & Per-Need Model Routing saved.');
      router.refresh();
    } else {
      setStatusMsg(data.error || 'Error saving AI routing.');
    }
  }

  async function handleTestEmail() {
    setTestingNeed('email');
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'parse_email',
        rawEmail:
          'Subject: Urgent Post-Incident Review - Cal Plains Roofing (Ref: GSC-WC-26-0412)\nNeed a post-incident ladder slip inspection at Cal Plains Roofing in Fresno, CA by 2026-04-25. Contact Superintendent Jorge Medina (jmedina@calplainsroofing.com, 559-555-0189).',
      }),
    });
    const data = await res.json();
    setTestingNeed(null);
    setTestOutput({ type: 'Email Intake ("Read it")', payload: data.parsed || data });
  }

  async function handleTestVoiceSTT() {
    setTestingNeed('stt');
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'transcribe_audio',
        fileName: 'west_dock_walkthrough_memo.m4a',
        memberName: 'Cal Plains Roofing',
        siteName: 'West Loading Dock Roof Access',
      }),
    });
    const data = await res.json();
    setTestingNeed(null);
    setTestOutput({ type: 'ElevenLabs Scribe v1 Voice Transcription', payload: data });
  }

  async function handleTestTTS() {
    setTestingNeed('tts');
    const sampleText =
      'Safety Alchemist Quick Report Summary for Cal Plains Roofing. Two high-priority fall protection findings identified on the West Loading Dock ladder and North Perimeter warning line.';
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'tts_briefing',
        text: sampleText,
      }),
    });
    const data = await res.json();
    setTestingNeed(null);
    setTestOutput({
      type: 'ElevenLabs TTS Inspector Readback',
      payload: {
        model_used: data.model_used,
        voice_id: data.voice_id,
        status: data.audioDataUrl
          ? 'Generated MP3 Stream Ready'
          : 'Browser SpeechSynthesis Fallback Active (Add ELEVENLABS_API_KEY for studio voice)',
        sample_text: sampleText,
      },
    });
    if (data.audioDataUrl && typeof window !== 'undefined') {
      const audio = new Audio(data.audioDataUrl);
      audio.play().catch(() => {});
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(sampleText);
      utter.rate = 1.03;
      window.speechSynthesis.speak(utter);
    }
  }

  const activeCatalogMeta = AI_PROVIDER_CATALOG.find(p => p.id === credTab);

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))' }}>
        <Frame className="stat">
          <div className="k">1 · Email Intake (&ldquo;Read it&rdquo;)</div>
          <div className="v" style={{ fontSize: 18, marginTop: 6 }}>
            {PROVIDER_SHORT_LABELS[routes.email.provider]}
          </div>
          <div className="s mono" style={{ fontSize: 10.5, color: 'var(--acc)', fontWeight: 600 }}>
            {routes.email.model}
          </div>
        </Frame>

        <Frame className="stat">
          <div className="k">2 · Quick Report Drafting</div>
          <div className="v" style={{ fontSize: 18, marginTop: 6 }}>
            {PROVIDER_SHORT_LABELS[routes.report.provider]}
          </div>
          <div className="s mono" style={{ fontSize: 10.5, color: 'var(--acc)', fontWeight: 600 }}>
            {routes.report.model}
          </div>
        </Frame>

        <Frame className="stat">
          <div className="k">3 · Photo Vision &amp; Citations</div>
          <div className="v" style={{ fontSize: 18, marginTop: 6 }}>
            {PROVIDER_SHORT_LABELS[routes.vision.provider]}
          </div>
          <div className="s mono" style={{ fontSize: 10.5, color: 'var(--acc)', fontWeight: 600 }}>
            {routes.vision.model}
          </div>
        </Frame>

        <Frame className="stat">
          <div className="k">4 · Expense Receipt OCR</div>
          <div className="v" style={{ fontSize: 18, marginTop: 6 }}>
            {PROVIDER_SHORT_LABELS[routes.ocr.provider]}
          </div>
          <div className="s mono" style={{ fontSize: 10.5, color: 'var(--acc)', fontWeight: 600 }}>
            {routes.ocr.model}
          </div>
        </Frame>

        <Frame className="stat">
          <div className="k">5 · Voice Memo &amp; Readback</div>
          <div className="v" style={{ fontSize: 18, marginTop: 6 }}>
            {PROVIDER_SHORT_LABELS[routes.stt.provider]}
          </div>
          <div className="s mono" style={{ fontSize: 10.5, color: 'var(--ok)', fontWeight: 600 }}>
            STT: {routes.stt.model} · TTS: {routes.tts.model}
          </div>
        </Frame>
      </div>

      <div className="cols" style={{ gridTemplateColumns: '1.35fr 1fr', alignItems: 'start' }}>
        <Frame className="strong">
          <div className="panel-head">
            <div>
              <h2>Per-Need AI Provider &amp; Model Routing</h2>
              <div className="sub">Assign the ideal AI provider and model independently for each workflow task</div>
            </div>
            {canEdit && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => applyPreset('aws_elevenlabs')}
                >
                  ★ Preset: AWS Qwen + ElevenLabs
                </button>
                <button type="button" className="btn btn-sm" onClick={() => applyPreset('all_aws')}>
                  All AWS
                </button>
                <button type="button" className="btn btn-sm" onClick={() => applyPreset('azure_elevenlabs')}>
                  Azure + ElevenLabs
                </button>
              </div>
            )}
          </div>

          <div className="panel-body">
            {AI_NEEDS_METADATA.map((need, idx) => {
              const recommendedProvider: AIProviderId =
                need.modality === 'stt' || need.modality === 'tts' ? 'elevenlabs' : 'aws_bedrock';
              const currentRoute = routes[need.key] || {
                provider: recommendedProvider,
                model: getModelsForProviderAndModality(recommendedProvider, need.modality)[0]?.id || '',
              };
              const availableModels = getModelsForProviderAndModality(currentRoute.provider, need.modality);
              const isCustom = customModelMode[need.key];

              return (
                <div
                  key={need.key}
                  style={{
                    padding: '14px 16px',
                    background: 'var(--bg-soft)',
                    border: '1px solid var(--div)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="code">NEED 0{idx + 1}</span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{need.title}</span>
                        <Pill
                          kind={
                            currentRoute.provider === 'elevenlabs'
                              ? 'ok'
                              : currentRoute.provider === 'aws_bedrock'
                              ? 'amber'
                              : 'neutral'
                          }
                        >
                          {need.surface}
                        </Pill>
                      </div>
                      <div className="sub" style={{ marginTop: 4 }}>{need.description}</div>
                    </div>

                    {canEdit && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() =>
                          setCustomModelMode(prev => ({
                            ...prev,
                            [need.key]: !prev[need.key],
                          }))
                        }
                      >
                        {isCustom ? 'Use Preset Catalog' : 'Custom Model ID'}
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.45fr', gap: 12 }}>
                    <label className="field">
                      <span>AI Provider ({need.shortTitle})</span>
                      <select
                        className="select"
                        value={currentRoute.provider}
                        disabled={!canEdit}
                        onChange={e =>
                          handleProviderChange(need.key, need.modality, e.target.value as AIProviderId)
                        }
                      >
                        {need.supportedProviders.map(provKey => (
                          <option key={provKey} value={provKey}>
                            {PROVIDER_SHORT_LABELS[provKey]}
                            {provKey === recommendedProvider ? ' (Recommended)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>{isCustom ? 'Custom Deployment / Model ID' : 'Target Model'}</span>
                      {isCustom ? (
                        <input
                          type="text"
                          className="input mono"
                          value={currentRoute.model}
                          disabled={!canEdit}
                          onChange={e => handleModelChange(need.key, e.target.value)}
                          placeholder="Enter exact Model ID or ARN..."
                        />
                      ) : (
                        <select
                          className="select"
                          disabled={!canEdit}
                          value={
                            availableModels.some(m => m.id === currentRoute.model)
                              ? currentRoute.model
                              : availableModels[0]?.id || currentRoute.model
                          }
                          onChange={e => handleModelChange(need.key, e.target.value)}
                        >
                          {availableModels.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.label} [{m.tier}]
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                  </div>
                </div>
              );
            })}

            <div
              style={{
                paddingTop: 14,
                borderTop: '1px solid var(--div)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={fallbackToDeterministic}
                  disabled={!canEdit}
                  onChange={e => setFallbackToDeterministic(e.target.checked)}
                />
                <span>
                  Auto-fallback to built-in OSHA/Cal-OSHA/WA-DOSH deterministic engine when cloud keys are offline
                </span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {statusMsg && <Pill kind="ok">{statusMsg}</Pill>}
                <button type="submit" className="btn btn-primary" disabled={saving || !canEdit}>
                  {saving ? 'Encrypting & Saving...' : 'Save Per-Need AI Routing'}
                </button>
              </div>
            </div>
          </div>
        </Frame>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Frame>
            <div className="panel-head">
              <div>
                <h2>Encrypted Cloud Credentials Vault</h2>
                <div className="sub">
                  Secrets are encrypted at rest with AES-256-GCM and never serialized back to the browser
                </div>
              </div>
              <Pill kind="verified">AES-256-GCM</Pill>
            </div>

            <div className="panel-body">
              <div className="tabs" style={{ width: '100%' }}>
                {(
                  [
                    ['aws_bedrock', 'AWS Bedrock'],
                    ['elevenlabs', 'ElevenLabs Voice'],
                    ['azure_ai', 'Azure AI'],
                    ['openai_compat', 'OpenAI / vLLM'],
                  ] as const
                ).map(([tabKey, label]) => (
                  <button
                    key={tabKey}
                    type="button"
                    style={{ flex: 1 }}
                    className={'tab ' + (credTab === tabKey ? 'on' : '')}
                    onClick={() => setCredTab(tabKey)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {credTab === 'aws_bedrock' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="note">
                    {activeCatalogMeta?.description} Custom endpoints are validated against SSRF private-IP &amp; cloud
                    metadata ranges.
                  </div>

                  <label className="field">
                    <span>AWS Region</span>
                    <select className="select" value={awsRegion} disabled={!canEdit} onChange={e => setAwsRegion(e.target.value)}>
                      <option value="us-west-2">us-west-2 (Oregon · Full Qwen &amp; Nova Catalog)</option>
                      <option value="us-east-1">us-east-1 (N. Virginia · Nova &amp; Llama 3.3)</option>
                      <option value="us-east-2">us-east-2 (Ohio · Cross-Region Inference)</option>
                      <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Bedrock OpenAI-Compatible / Mantle Endpoint (HTTPS)</span>
                    <input
                      type="text"
                      className="input mono"
                      value={awsBedrockEndpoint}
                      disabled={!canEdit}
                      onChange={e => setAwsBedrockEndpoint(e.target.value)}
                      placeholder={`https://bedrock-runtime.${awsRegion}.amazonaws.com/openai/v1`}
                    />
                  </label>

                  <label className="field">
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Bedrock Bearer Token</span>
                      {masked.awsBedrockApiKey && canEdit && (
                        <button type="button" className="btn btn-sm" onClick={() => toggleClearSecret('awsBedrockApiKey')}>
                          {clearSecrets.includes('awsBedrockApiKey') ? 'Keep Saved Key' : 'Clear Saved Key'}
                        </button>
                      )}
                    </span>
                    <input
                      type="password"
                      className="input mono"
                      value={awsBedrockApiKey}
                      disabled={!canEdit}
                      onChange={e => setAwsBedrockApiKey(e.target.value)}
                      placeholder={secretPlaceholder('awsBedrockApiKey', 'Enter new Bedrock token (or uses .env default)')}
                    />
                  </label>
                </div>
              )}

              {credTab === 'elevenlabs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label className="field">
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>ElevenLabs API Key (xi-api-key)</span>
                      {masked.elevenlabsApiKey && canEdit && (
                        <button type="button" className="btn btn-sm" onClick={() => toggleClearSecret('elevenlabsApiKey')}>
                          {clearSecrets.includes('elevenlabsApiKey') ? 'Keep Saved Key' : 'Clear Saved Key'}
                        </button>
                      )}
                    </span>
                    <input
                      type="password"
                      className="input mono"
                      value={elevenlabsApiKey}
                      disabled={!canEdit}
                      onChange={e => setElevenlabsApiKey(e.target.value)}
                      placeholder={secretPlaceholder('elevenlabsApiKey', 'xi-... (Uses .env ELEVENLABS_API_KEY if blank)')}
                    />
                  </label>

                  <label className="field">
                    <span>Inspector Readback Voice Persona (ElevenLabs TTS)</span>
                    <select
                      className="select"
                      value={elevenlabsVoiceId}
                      disabled={!canEdit}
                      onChange={e => setElevenlabsVoiceId(e.target.value)}
                    >
                      {ELEVENLABS_VOICES.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {credTab === 'azure_ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label className="field">
                    <span>Azure AI Inference Endpoint (HTTPS)</span>
                    <input
                      type="text"
                      className="input mono"
                      value={azureEndpoint}
                      disabled={!canEdit}
                      onChange={e => setAzureEndpoint(e.target.value)}
                      placeholder="https://<resource>.services.ai.azure.com/models"
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
                    <label className="field">
                      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Azure API Key</span>
                        {masked.azureApiKey && canEdit && (
                          <button type="button" className="btn btn-sm" onClick={() => toggleClearSecret('azureApiKey')}>
                            {clearSecrets.includes('azureApiKey') ? 'Keep' : 'Clear'}
                          </button>
                        )}
                      </span>
                      <input
                        type="password"
                        className="input mono"
                        value={azureApiKey}
                        disabled={!canEdit}
                        onChange={e => setAzureApiKey(e.target.value)}
                        placeholder={secretPlaceholder('azureApiKey', 'Uses .env AZURE_AI_API_KEY')}
                      />
                    </label>
                    <label className="field">
                      <span>API Version</span>
                      <input
                        type="text"
                        className="input mono"
                        value={azureApiVersion}
                        disabled={!canEdit}
                        onChange={e => setAzureApiVersion(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              )}

              {credTab === 'openai_compat' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label className="field">
                    <span>Base URL</span>
                    <input
                      type="text"
                      className="input mono"
                      value={openaiBaseUrl}
                      disabled={!canEdit}
                      onChange={e => setOpenaiBaseUrl(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                    />
                  </label>

                  <label className="field">
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Bearer API Key</span>
                      {masked.openaiApiKey && canEdit && (
                        <button type="button" className="btn btn-sm" onClick={() => toggleClearSecret('openaiApiKey')}>
                          {clearSecrets.includes('openaiApiKey') ? 'Keep Saved Key' : 'Clear Saved Key'}
                        </button>
                      )}
                    </span>
                    <input
                      type="password"
                      className="input mono"
                      value={openaiApiKey}
                      disabled={!canEdit}
                      onChange={e => setOpenaiApiKey(e.target.value)}
                      placeholder={secretPlaceholder('openaiApiKey', 'sk-...')}
                    />
                  </label>
                </div>
              )}
            </div>
          </Frame>

          <Frame>
            <div className="panel-head">
              <div>
                <h2>Live Per-Need Test Bench</h2>
                <div className="sub">Verify your active provider routing</div>
              </div>
              <Pill kind="amber">Diagnostics</Pill>
            </div>

            <div className="panel-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ width: '100%', height: 38 }}
                  disabled={testingNeed !== null}
                  onClick={handleTestEmail}
                >
                  {testingNeed === 'email' ? 'Testing Email Intake...' : '1. Test "Read it" Email Intake'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ width: '100%', height: 38 }}
                  disabled={testingNeed !== null}
                  onClick={handleTestVoiceSTT}
                >
                  {testingNeed === 'stt' ? 'Transcribing...' : '2. Test ElevenLabs Scribe STT'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ width: '100%', height: 38 }}
                  disabled={testingNeed !== null}
                  onClick={handleTestTTS}
                >
                  {testingNeed === 'tts' ? 'Synthesizing...' : '🔊 3. Test ElevenLabs TTS'}
                </button>
              </div>

              {testOutput && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ok)' }}>
                      ✓ {testOutput.type}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ padding: '2px 8px', height: 24, fontSize: 10 }}
                      onClick={() => setTestOutput(null)}
                    >
                      Clear
                    </button>
                  </div>
                  <pre
                    className="mono"
                    style={{
                      margin: 0,
                      padding: 12,
                      background: 'var(--bg-soft)',
                      border: '1px solid var(--div)',
                      fontSize: 11,
                      maxHeight: 230,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {JSON.stringify(testOutput.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </Frame>
        </div>
      </div>
    </form>
  );
}
