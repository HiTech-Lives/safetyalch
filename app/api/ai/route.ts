import { NextResponse } from 'next/server';
import { requireApiSession, apiErrorResponse } from '@/lib/session';
import { getTenant } from '@/lib/queries';
import { exec, audit } from '@/lib/db';
import {
  assertSafeOutboundUrl,
  decryptCredentialsMap,
  encryptCredentialsMap,
  checkRateLimit,
} from '@/lib/security';
import {
  resolveAIConfig,
  maskAIConfigForClient,
  parseEmailToJob,
  analyzeCapturePhotosAndVoice,
  generateQuickReportNarrative,
  parseReceiptOCR,
  transcribeVoiceMemo,
  synthesizeSpeechBriefing,
} from '@/lib/ai';

const SECRET_KEYS = [
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'awsBedrockApiKey',
  'azureApiKey',
  'elevenlabsApiKey',
  'openaiApiKey',
  'geminiApiKey',
  'anthropicApiKey',
] as const;

export async function POST(req: Request) {
  try {
    const s = await requireApiSession(req);
    const rl = checkRateLimit(`ai:${s.user.id}`, 40, 5 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: `AI rate limit reached. Retry in ${rl.retryAfterSec}s.` }, { status: 429 });
    }

    const tenant = await getTenant(s);
    const body = await req.json();
    const action = body.action;

    if (action === 'save_config') {
      if (!s.permissions.has('team:brand.manage')) {
        return NextResponse.json({ error: 'Missing team:brand.manage permission to update AI configuration.' }, { status: 403 });
      }

      // Validate custom outbound AI endpoints against SSRF / metadata IPs
      for (const endpointField of ['awsBedrockEndpoint', 'azureEndpoint', 'openaiBaseUrl'] as const) {
        const val = String(body[endpointField] || '').trim();
        if (val && val !== 'https://api.openai.com/v1') {
          await assertSafeOutboundUrl(val, { allowLocalDev: true });
        }
      }

      const routes = body.routes || {
        email: { provider: body.provider || 'aws_bedrock', model: body.textModel || 'qwen.qwen2.5-32b-instruct-v1:0' },
        report: { provider: body.provider || 'aws_bedrock', model: body.textModel || 'qwen.qwen2.5-32b-instruct-v1:0' },
        vision: { provider: body.provider || 'aws_bedrock', model: body.visionModel || 'qwen.qwen2.5-vl-72b-instruct' },
        ocr: { provider: body.provider || 'aws_bedrock', model: body.visionModel || 'qwen.qwen2.5-vl-72b-instruct' },
        stt: { provider: 'elevenlabs', model: body.audioModel || 'scribe_v1' },
        tts: { provider: 'elevenlabs', model: 'eleven_flash_v2_5' },
      };

      // Merge secrets into AES-256-GCM encrypted column; strip raw secrets from ai_config_json
      const existingCreds = decryptCredentialsMap(tenant.ai_credentials_enc);
      const clearSet = new Set<string>(Array.isArray(body.clearSecrets) ? body.clearSecrets : []);
      const nextCreds: Record<string, string> = { ...existingCreds };
      for (const k of SECRET_KEYS) {
        if (clearSet.has(k)) {
          delete nextCreds[k];
        } else if (typeof body[k] === 'string' && body[k].trim() && !body[k].startsWith('••••')) {
          nextCreds[k] = body[k].trim();
        }
      }
      const encryptedCreds = encryptCredentialsMap(nextCreds);

      const nextConfig = {
        provider: routes.email?.provider || body.provider || 'aws_bedrock',
        routes,
        awsRegion: body.awsRegion || 'us-west-2',
        awsBedrockEndpoint: String(body.awsBedrockEndpoint || '').trim(),
        azureEndpoint: String(body.azureEndpoint || '').trim(),
        azureApiVersion: body.azureApiVersion || '2024-05-01-preview',
        azureModel: body.azureModel || 'Qwen2.5-32B-Instruct',
        openaiBaseUrl: String(body.openaiBaseUrl || '').trim(),
        elevenlabsVoiceId: body.elevenlabsVoiceId || 'JBFqnCBsd6RMkjVDRZzb',
        textModel: routes.email?.model || body.textModel || 'qwen.qwen2.5-32b-instruct-v1:0',
        visionModel: routes.vision?.model || body.visionModel || 'qwen.qwen2.5-vl-72b-instruct',
        audioModel: routes.stt?.model || body.audioModel || 'scribe_v1',
        fallbackToDeterministic: body.fallbackToDeterministic !== false,
      };

      await exec('UPDATE tenants SET ai_config_json=?, ai_credentials_enc=? WHERE id=?', [
        JSON.stringify(nextConfig),
        encryptedCreds,
        s.tenantId,
      ]);
      await audit(
        s.tenantId,
        s.user.id,
        'ai.config_updated',
        'tenant',
        s.tenantId,
        { provider: nextConfig.provider, routes },
        s.impersonation?.platformUserId
      );

      const masked = maskAIConfigForClient(resolveAIConfig(nextConfig, encryptedCreds));
      return NextResponse.json({ ok: true, config: masked });
    }

    if (!s.permissions.has('team:inspections.execute') && !s.permissions.has('team:members.assign')) {
      return NextResponse.json({ error: 'Permission denied to invoke field AI workflows.' }, { status: 403 });
    }

    const cfg = resolveAIConfig(tenant.ai_config_json, tenant.ai_credentials_enc);

    if (action === 'parse_email') {
      const parsed = await parseEmailToJob(String(body.rawEmail || ''), cfg);
      return NextResponse.json({ ok: true, parsed });
    }

    if (action === 'analyze_capture') {
      const result = await analyzeCapturePhotosAndVoice(
        {
          memberName: String(body.memberName || 'Cal Plains Roofing'),
          siteName: String(body.siteName || 'Primary Site'),
          jurisdiction: String(body.jurisdiction || 'CA'),
          photos: Array.isArray(body.photos) ? body.photos : [],
          voiceTranscript: String(body.voiceTranscript || ''),
        },
        cfg
      );
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'generate_quick_report') {
      const result = await generateQuickReportNarrative(
        {
          templateType: body.templateType || 'post_incident',
          memberName: String(body.memberName || 'Cal Plains Roofing'),
          siteName: String(body.siteName || 'Primary Site'),
          carrierRef: body.carrierRef,
          programTitle: body.programTitle,
          photos: Array.isArray(body.photos) ? body.photos : [],
          voiceTranscript: String(body.voiceTranscript || ''),
          fieldNotes: String(body.fieldNotes || ''),
        },
        cfg
      );
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'parse_receipt') {
      const result = await parseReceiptOCR(String(body.fileName || ''), String(body.hintText || ''), cfg);
      return NextResponse.json({ ok: true, receipt: result });
    }

    if (action === 'transcribe_audio') {
      const result = await transcribeVoiceMemo(
        {
          fileName: body.fileName,
          audioBase64: body.audioBase64,
          promptContext: body.memberName
            ? `${body.memberName}${body.siteName ? ` — ${body.siteName}` : ''}`
            : body.promptContext,
        },
        cfg
      );
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'tts_briefing') {
      const result = await synthesizeSpeechBriefing(String(body.text || ''), cfg);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'Unknown AI action' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
