// Browser-safe AI Provider, Modality & Model Catalog definitions.
// Contains zero Node.js or database imports so client UI components can safely import metadata.

export type AIProviderId =
  | 'aws_bedrock'
  | 'azure_ai'
  | 'elevenlabs'
  | 'openai_compat'
  | 'gemini'
  | 'anthropic'
  | 'deterministic';

export type AINeedKey = 'email' | 'report' | 'vision' | 'ocr' | 'stt' | 'tts';

export type AINeedRoute = {
  provider: AIProviderId;
  model: string;
};

export type AIConfig = {
  provider: AIProviderId;
  routes: Record<AINeedKey, AINeedRoute>;
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsBedrockEndpoint?: string;
  awsBedrockApiKey?: string;
  azureEndpoint?: string;
  azureApiKey?: string;
  azureApiVersion?: string;
  azureModel?: string;
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  openaiBaseUrl?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  anthropicApiKey?: string;
  textModel: string;
  visionModel: string;
  audioModel: string;
  fallbackToDeterministic: boolean;
};

export const AI_NEEDS_METADATA: {
  key: AINeedKey;
  title: string;
  shortTitle: string;
  modality: 'text' | 'vision' | 'stt' | 'tts';
  surface: string;
  description: string;
  supportedProviders: AIProviderId[];
}[] = [
  {
    key: 'email',
    title: '1. Email-to-Job Intake ("Read it")',
    shortTitle: 'Email Intake',
    modality: 'text',
    surface: 'Work Queue (/work-queue)',
    description: 'Extracts 16 structured dispatch fields (Carrier Ref, Insured, Broker, Site Contact, Fee, Due Date) from request emails.',
    supportedProviders: ['aws_bedrock', 'azure_ai', 'openai_compat', 'gemini', 'anthropic', 'deterministic'],
  },
  {
    key: 'report',
    title: '2. Quick Report Narrative Drafting ("In the Truck")',
    shortTitle: 'Quick Reports',
    modality: 'text',
    surface: 'Field Quick Report (/field/quick-report)',
    description: 'Drafts 7-section Post-Incident Reviews, Equipment Breakdown Surveys, and Program Manager Summaries.',
    supportedProviders: ['aws_bedrock', 'azure_ai', 'openai_compat', 'gemini', 'anthropic', 'deterministic'],
  },
  {
    key: 'vision',
    title: '3. Field Photo Vision & OSHA/State Citation Pairing',
    shortTitle: 'Photo Vision',
    modality: 'vision',
    surface: 'AI Quick Capture (/field/capture)',
    description: 'Analyzes numbered site walk photos, writes hazard captions, and pairs Federal 29 CFR + State (Cal/OSHA · WA DOSH) codes.',
    supportedProviders: ['aws_bedrock', 'azure_ai', 'openai_compat', 'gemini', 'anthropic', 'deterministic'],
  },
  {
    key: 'ocr',
    title: '4. Expense Receipt OCR Scanner',
    shortTitle: 'Receipt OCR',
    modality: 'vision',
    surface: 'Mobile Expenses (/field/jobs)',
    description: 'Extracts Merchant, Date, Total Amount, and Expense Category from snapped hotel, meal, and lab receipts.',
    supportedProviders: ['aws_bedrock', 'azure_ai', 'openai_compat', 'gemini', 'anthropic', 'deterministic'],
  },
  {
    key: 'stt',
    title: '5. Field Voice Memo Transcription (Speech-to-Text)',
    shortTitle: 'Voice STT',
    modality: 'stt',
    surface: 'Quick Capture & Quick Report',
    description: 'Transcribes inspector voice memos (.m4a, .mp3, .wav, live mic) with speaker & sub-contractor entity recognition.',
    supportedProviders: ['elevenlabs', 'aws_bedrock', 'azure_ai', 'openai_compat', 'gemini', 'deterministic'],
  },
  {
    key: 'tts',
    title: '6. Inspector Audio Briefing & Report Readback (Text-to-Speech)',
    shortTitle: 'Audio Readback',
    modality: 'tts',
    surface: 'Quick Report & Arrival Prep',
    description: 'Reads generated Quick Reports and site arrival briefings aloud in the truck via natural voice synthesis.',
    supportedProviders: ['elevenlabs', 'aws_bedrock', 'azure_ai', 'openai_compat', 'deterministic'],
  },
];

export const ELEVENLABS_VOICES = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George — Senior Loss Control Narrator (Clear, Authoritative)' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah — Executive Risk Advisor (Warm, Articulate)' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel — Field Operations Briefing (Steady, Direct)' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda — Compliance & QC Reviewer (Crisp, Professional)' },
];

export const AI_PROVIDER_CATALOG: {
  id: AIProviderId;
  name: string;
  shortName: string;
  badge: string;
  description: string;
  textModels: { id: string; label: string; tier: string }[];
  visionModels: { id: string; label: string; tier: string }[];
  sttModels: { id: string; label: string; tier: string }[];
  ttsModels: { id: string; label: string; tier: string }[];
  audioModels: { id: string; label: string; tier?: string }[];
}[] = [
  {
    id: 'aws_bedrock',
    name: 'AWS Bedrock',
    shortName: 'AWS Bedrock',
    badge: 'Primary Cloud · Low Cost',
    description:
      'Run open-weight Qwen 2.5 / Qwen 3, Amazon Nova Micro/Lite, or Llama 3.3 on AWS Bedrock.',
    textModels: [
      { id: 'qwen.qwen2.5-32b-instruct-v1:0', label: 'Qwen 2.5 32B Instruct', tier: 'Low Cost · Fast' },
      { id: 'qwen.qwen3-32b-v1:0', label: 'Qwen 3 32B Instruct', tier: 'Reasoning' },
      { id: 'qwen.qwen2.5-72b-instruct-v1:0', label: 'Qwen 2.5 72B Instruct', tier: 'High Accuracy' },
      { id: 'amazon.nova-micro-v1:0', label: 'Amazon Nova Micro v1', tier: 'Ultra-Low Cost' },
      { id: 'amazon.nova-lite-v1:0', label: 'Amazon Nova Lite v1', tier: 'Balanced' },
      { id: 'meta.llama3-3-70b-instruct-v1:0', label: 'Meta Llama 3.3 70B Instruct', tier: 'Open Weight' },
    ],
    visionModels: [
      { id: 'qwen.qwen2.5-vl-72b-instruct', label: 'Qwen 2.5-VL 72B Vision & OCR', tier: 'Best Open Vision' },
      { id: 'qwen.qwen2.5-vl-7b-instruct', label: 'Qwen 2.5-VL 7B Vision', tier: 'Ultra-Low Cost' },
      { id: 'amazon.nova-lite-v1:0', label: 'Amazon Nova Lite Multimodal', tier: 'Fast Vision/OCR' },
      { id: 'amazon.nova-pro-v1:0', label: 'Amazon Nova Pro Multimodal', tier: 'Dense OCR' },
    ],
    sttModels: [
      { id: 'aws.transcribe-streaming', label: 'Amazon Transcribe Streaming + Qwen Cleanup', tier: 'AWS Native' },
      { id: 'whisper-large-v3-turbo', label: 'Whisper Large v3 Turbo (Bedrock Endpoint)', tier: 'Open Weight' },
    ],
    ttsModels: [
      { id: 'amazon.polly-neural-matthew', label: 'Amazon Polly Neural (Matthew)', tier: 'AWS Native' },
    ],
    audioModels: [
      { id: 'aws.transcribe-streaming', label: 'Amazon Transcribe Streaming + Qwen Cleanup', tier: 'AWS Native' },
    ],
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs Voice AI',
    shortName: 'ElevenLabs',
    badge: 'Best-in-Class Voice STT & TTS',
    description:
      'Industry-leading Scribe v1 speech-to-text for noisy jobsite voice memos + Flash v2.5 neural audio readbacks.',
    textModels: [],
    visionModels: [],
    sttModels: [
      { id: 'scribe_v1', label: 'ElevenLabs Scribe v1 (99-Language + Diarization)', tier: 'Highest Accuracy STT' },
      { id: 'scribe_v1_experimental', label: 'ElevenLabs Scribe v1 Experimental (Noisy Jobsite)', tier: 'Field Tuned' },
    ],
    ttsModels: [
      { id: 'eleven_flash_v2_5', label: 'ElevenLabs Flash v2.5 (75ms Ultra-Low Latency)', tier: 'Fastest Truck Readback' },
      { id: 'eleven_multilingual_v2', label: 'ElevenLabs Multilingual v2 (English / Spanish)', tier: 'Studio Quality' },
      { id: 'eleven_turbo_v2_5', label: 'ElevenLabs Turbo v2.5', tier: 'Balanced' },
    ],
    audioModels: [
      { id: 'scribe_v1', label: 'ElevenLabs Scribe v1 (Speech-to-Text)', tier: 'Highest Accuracy STT' },
    ],
  },
  {
    id: 'azure_ai',
    name: 'Azure AI Foundry / Azure OpenAI',
    shortName: 'Azure AI',
    badge: 'Enterprise Cloud',
    description:
      'Deploy Qwen 2.5, Microsoft Phi-4 Multimodal, Llama 3.3, or GPT-4o-mini on Azure AI Foundry.',
    textModels: [
      { id: 'Qwen2.5-32B-Instruct', label: 'Qwen 2.5 32B Instruct (Azure)', tier: 'Low Cost · Fast' },
      { id: 'Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B Instruct (Azure)', tier: 'High Accuracy' },
      { id: 'Phi-4', label: 'Microsoft Phi-4 (14B SLM)', tier: 'Ultra-Low Cost' },
      { id: 'gpt-4o-mini', label: 'Azure OpenAI GPT-4o-mini', tier: 'Commercial' },
    ],
    visionModels: [
      { id: 'Phi-4-multimodal-instruct', label: 'Microsoft Phi-4 Multimodal', tier: 'Low Cost Vision' },
      { id: 'Qwen2.5-VL-72B-Instruct', label: 'Qwen 2.5-VL 72B (Azure)', tier: 'High Accuracy OCR' },
      { id: 'gpt-4o-mini', label: 'Azure OpenAI GPT-4o-mini Vision', tier: 'Fast Multimodal' },
    ],
    sttModels: [
      { id: 'azure-whisper', label: 'Azure OpenAI Whisper', tier: 'Cloud STT' },
      { id: 'Phi-4-multimodal-instruct', label: 'Phi-4 Multimodal Audio', tier: 'SLM Audio' },
    ],
    ttsModels: [
      { id: 'azure-neural-tts', label: 'Azure AI Speech Neural TTS', tier: 'Enterprise' },
    ],
    audioModels: [{ id: 'azure-whisper', label: 'Azure OpenAI Whisper', tier: 'Cloud STT' }],
  },
  {
    id: 'openai_compat',
    name: 'OpenAI / Self-Hosted vLLM / Ollama',
    shortName: 'OpenAI / vLLM',
    badge: 'Custom Endpoint',
    description: 'Any OpenAI-compatible /v1/chat/completions server (vLLM running Qwen, Ollama, or OpenAI).',
    textModels: [
      { id: 'Qwen/Qwen2.5-32B-Instruct', label: 'Qwen/Qwen2.5-32B-Instruct (vLLM)', tier: 'Self-Hosted' },
      { id: 'gpt-4o-mini', label: 'OpenAI gpt-4o-mini', tier: 'Cloud' },
    ],
    visionModels: [
      { id: 'Qwen/Qwen2.5-VL-7B-Instruct', label: 'Qwen/Qwen2.5-VL-7B-Instruct (vLLM)', tier: 'Self-Hosted' },
      { id: 'gpt-4o-mini', label: 'OpenAI gpt-4o-mini Vision', tier: 'Cloud' },
    ],
    sttModels: [{ id: 'whisper-1', label: 'OpenAI Whisper-1', tier: 'Cloud' }],
    ttsModels: [{ id: 'tts-1', label: 'OpenAI TTS-1', tier: 'Cloud' }],
    audioModels: [{ id: 'whisper-1', label: 'OpenAI Whisper-1', tier: 'Cloud' }],
  },
  {
    id: 'gemini',
    name: 'Google Gemini API',
    shortName: 'Gemini',
    badge: 'Optional Cloud',
    description: 'Google Gemini 2.5 Flash-Lite / Flash multimodal API.',
    textModels: [
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', tier: 'Low Cost' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tier: 'Balanced' },
    ],
    visionModels: [{ id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite Vision', tier: 'Low Cost' }],
    sttModels: [{ id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Native Audio STT', tier: 'Multimodal' }],
    ttsModels: [],
    audioModels: [{ id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Native Audio', tier: 'Multimodal' }],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude API',
    shortName: 'Anthropic',
    badge: 'Optional Cloud',
    description: 'Anthropic Claude 3.5 Haiku / Sonnet endpoint.',
    textModels: [{ id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku', tier: 'Fast' }],
    visionModels: [{ id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet Vision', tier: 'Vision' }],
    sttModels: [],
    ttsModels: [],
    audioModels: [],
  },
  {
    id: 'deterministic',
    name: 'Built-In Local Domain Engine',
    shortName: 'Local Engine',
    badge: 'Zero Cloud Cost',
    description: 'Built-in OSHA/Cal-OSHA/WA-DOSH rule parser & browser speech synthesis. 0ms latency.',
    textModels: [{ id: 'tsa-deterministic-v2', label: 'Safety Alchemist Rule Parser v2', tier: '0ms Local' }],
    visionModels: [{ id: 'tsa-vision-heuristics-v2', label: 'Safety Alchemist Photo & Receipt Heuristics', tier: '0ms Local' }],
    sttModels: [{ id: 'tsa-speech-norm-v2', label: 'Browser Web Speech + Field Normalizer', tier: '0ms Local' }],
    ttsModels: [{ id: 'browser-speech-synthesis', label: 'Browser Native SpeechSynthesis', tier: '0ms Local' }],
    audioModels: [{ id: 'tsa-speech-norm-v2', label: 'Browser Web Speech + Field Normalizer', tier: '0ms Local' }],
  },
];

export function getModelsForProviderAndModality(
  providerId: AIProviderId,
  modality: 'text' | 'vision' | 'stt' | 'tts'
): { id: string; label: string; tier: string }[] {
  const cat = AI_PROVIDER_CATALOG.find(p => p.id === providerId);
  if (!cat) return [];
  if (modality === 'text') return cat.textModels;
  if (modality === 'vision') return cat.visionModels;
  if (modality === 'stt') return cat.sttModels;
  return cat.ttsModels;
}

