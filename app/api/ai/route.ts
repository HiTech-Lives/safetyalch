import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getTenant } from '@/lib/queries';
import { exec } from '@/lib/db';
import {
  resolveAIConfig,
  parseEmailToJob,
  analyzeCapturePhotosAndVoice,
  generateQuickReportNarrative,
  parseReceiptOCR,
  transcribeVoiceMemo,
  synthesizeSpeechBriefing,
} from '@/lib/ai';

export async function POST(req: Request) {
  const s = await getSession();
  const tenant = await getTenant(s);
  const body = await req.json();
  const action = body.action;

  if (action === 'save_config') {
    if (s.role !== 'owner' && s.role !== 'admin') {
      return NextResponse.json({ error: 'Only Owners and Admins can update AI model settings.' }, { status: 403 });
    }
    const routes = body.routes || {
      email: { provider: body.provider || 'aws_bedrock', model: body.textModel || 'qwen.qwen2.5-32b-instruct-v1:0' },
      report: { provider: body.provider || 'aws_bedrock', model: body.textModel || 'qwen.qwen2.5-32b-instruct-v1:0' },
      vision: { provider: body.provider || 'aws_bedrock', model: body.visionModel || 'qwen.qwen2.5-vl-72b-instruct' },
      ocr: { provider: body.provider || 'aws_bedrock', model: body.visionModel || 'qwen.qwen2.5-vl-72b-instruct' },
      stt: { provider: 'elevenlabs', model: body.audioModel || 'scribe_v1' },
      tts: { provider: 'elevenlabs', model: 'eleven_flash_v2_5' },
    };

    const nextConfig = {
      provider: routes.email?.provider || body.provider || 'aws_bedrock',
      routes,
      awsRegion: body.awsRegion || 'us-west-2',
      awsBedrockEndpoint: body.awsBedrockEndpoint || '',
      awsBedrockApiKey: body.awsBedrockApiKey || '',
      azureEndpoint: body.azureEndpoint || '',
      azureApiKey: body.azureApiKey || '',
      azureApiVersion: body.azureApiVersion || '2024-05-01-preview',
      azureModel: body.azureModel || 'Qwen2.5-32B-Instruct',
      openaiBaseUrl: body.openaiBaseUrl || '',
      openaiApiKey: body.openaiApiKey || '',
      elevenlabsApiKey: body.elevenlabsApiKey || '',
      elevenlabsVoiceId: body.elevenlabsVoiceId || 'JBFqnCBsd6RMkjVDRZzb',
      textModel: routes.email?.model || body.textModel || 'qwen.qwen2.5-32b-instruct-v1:0',
      visionModel: routes.vision?.model || body.visionModel || 'qwen.qwen2.5-vl-72b-instruct',
      audioModel: routes.stt?.model || body.audioModel || 'scribe_v1',
      fallbackToDeterministic: body.fallbackToDeterministic !== false,
    };
    await exec('UPDATE tenants SET ai_config_json=? WHERE id=?', [JSON.stringify(nextConfig), s.tenantId]);
    return NextResponse.json({ ok: true, config: nextConfig });
  }

  const cfg = resolveAIConfig(tenant.ai_config_json);

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
}
