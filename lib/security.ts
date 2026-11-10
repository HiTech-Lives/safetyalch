import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isIP } from 'node:net';

// ---------- Cryptographic IDs & Tokens ----------

export function genId(prefix?: string): string {
  if (!prefix) return randomUUID();
  // Short collision-resistant IDs for VARCHAR(20) / VARCHAR(36) PKs (e.g., I-..., R-..., J-...)
  const ts = Date.now().toString(36).slice(-5).toUpperCase();
  const rnd = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}${rnd}`;
}

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

// ---------- AES-256-GCM Secret Encryption at Rest ----------

function getMasterKey(): Buffer {
  const seed = process.env.APP_ENCRYPTION_KEY || process.env.DATABASE_URL || 'sa-dev-fallback-master-secret-v003';
  return scryptSync(seed, 'safety-alchemist-v003-aes-gcm', 32);
}

export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getMasterKey(), iv);
  const enc = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSecret(payload: string | null | undefined): string {
  if (!payload) return '';
  if (!payload.startsWith('v1:')) return '';
  const parts = payload.split(':');
  if (parts.length !== 4) return '';
  try {
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const data = Buffer.from(parts[3], 'hex');
    const decipher = createDecipheriv('aes-256-gcm', getMasterKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function encryptCredentialsMap(creds: Record<string, string>): string {
  return encryptSecret(JSON.stringify(creds));
}

export function decryptCredentialsMap(enc: string | null | undefined): Record<string, string> {
  const raw = decryptSecret(enc);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function maskSecret(secret: string | undefined | null): string {
  if (!secret || secret.length < 4) return '';
  return '••••••••••••' + secret.slice(-4);
}

// ---------- SSRF & Private-IP Egress Protection ----------

export function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();
  if (normalized === 'localhost') return true;
  if (normalized.startsWith('::ffff:')) {
    return isPrivateOrReservedIp(normalized.slice(7));
  }
  const family = isIP(normalized);
  if (family === 4) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // AWS/Azure/GCP IMDS link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // Multicast / reserved
    return false;
  }
  if (family === 6) {
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true; // fe80::/10
    return false;
  }
  return true;
}

export const OFFICIAL_REGULATION_HOST_SUFFIXES = [
  '.gov',
  '.mil',
  'state.ct.us',
  'state.nv.us',
  'state.ak.us',
  'state.vt.us',
  'osha.gov',
  'ecfr.gov',
  'federalregister.gov',
];

export async function assertSafeOutboundUrl(
  urlStr: string,
  options: { allowedHostSuffixes?: string[]; allowLocalDev?: boolean } = {}
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error('Invalid URL format.');
  }

  const allowLocal = Boolean(options.allowLocalDev && process.env.ALLOW_LOCAL_AI_ENDPOINTS === 'true');
  if (parsed.protocol !== 'https:' && !(allowLocal && parsed.protocol === 'http:')) {
    throw new Error('Only HTTPS URLs are permitted.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Credentials in URLs are not permitted.');
  }

  const host = parsed.hostname.toLowerCase();
  if (options.allowedHostSuffixes && options.allowedHostSuffixes.length > 0) {
    const matched = options.allowedHostSuffixes.some(sfx => {
      const clean = sfx.toLowerCase();
      return clean.startsWith('.') ? (host.endsWith(clean) || host === clean.slice(1)) : (host === clean || host.endsWith('.' + clean));
    });
    if (!matched) {
      throw new Error(`Host "${host}" is not in the approved regulatory domain allowlist.`);
    }
  }

  if (!allowLocal) {
    if (isIP(host) && isPrivateOrReservedIp(host)) {
      throw new Error('Connections to private, loopback, or metadata IP addresses are blocked.');
    }
    const records = await lookup(host, { all: true });
    if (!records.length) throw new Error('Unable to resolve target hostname.');
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        throw new Error('Target hostname resolved to a restricted private or loopback IP address.');
      }
    }
  }

  return parsed;
}

// ---------- CSRF Same-Origin Verification & Sliding-Window Rate Limiter ----------

export function verifySameOrigin(req: Request): { ok: true } | { ok: false; error: string } {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return { ok: true };

  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!origin || !host) {
    // Same-origin non-CORS browser fetches on modern browsers always send Origin on POST/PUT/DELETE/PATCH;
    // allow server-to-server tests without Origin only when Sec-Fetch-Site is not cross-site.
    const secFetchSite = req.headers.get('sec-fetch-site');
    if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
      return { ok: false, error: 'Cross-site request blocked (Sec-Fetch-Site).' };
    }
    return { ok: true };
  }
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const targetHost = host.split(',')[0].trim().toLowerCase();
    if (originHost === targetHost) return { ok: true };
    if (process.env.NODE_ENV !== 'production' && (originHost.startsWith('192.168.4.25') || originHost.startsWith('localhost:'))) {
      return { ok: true };
    }
    return { ok: false, error: 'Cross-origin state-changing request rejected.' };
  } catch {
    return { ok: false, error: 'Malformed Origin header.' };
  }
}

type RateBucket = { timestamps: number[] };
const rateBuckets = (globalThis as unknown as { __saRateBuckets?: Map<string, RateBucket> }).__saRateBuckets ?? new Map<string, RateBucket>();
(globalThis as unknown as { __saRateBuckets?: Map<string, RateBucket> }).__saRateBuckets = rateBuckets;

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = rateBuckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter(t => t > cutoff);
  if (bucket.timestamps.length >= maxRequests) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.timestamps[0] + windowMs - now) / 1000));
    rateBuckets.set(key, bucket);
    return { allowed: false, retryAfterSec };
  }
  bucket.timestamps.push(now);
  rateBuckets.set(key, bucket);
  return { allowed: true, retryAfterSec: 0 };
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

// ---------- Magic-Byte Validated Private File Storage ----------

export type ValidatedFileResult = {
  fileId: string;
  mimeType: string;
  ext: string;
  byteSize: number;
  diskPath: string;
};

export async function validateAndStoreUpload(
  file: File,
  tenantId: string,
  options: { maxBytes?: number; allowPdf?: boolean } = {}
): Promise<ValidatedFileResult> {
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024; // 8 MB default
  if (file.size <= 0) throw new Error('Uploaded file is empty.');
  if (file.size > maxBytes) {
    throw new Error(`File exceeds maximum size of ${Math.round(maxBytes / (1024 * 1024))} MB.`);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length < 12) throw new Error('Invalid or truncated binary file.');

  // Detect magic bytes strictly — SVG / XML / HTML are NEVER accepted
  let mimeType = '';
  let ext = '';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    mimeType = 'image/png';
    ext = 'png';
  } else if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    mimeType = 'image/jpeg';
    ext = 'jpg';
  } else if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    mimeType = 'image/webp';
    ext = 'webp';
  } else if (options.allowPdf && buf.subarray(0, 5).toString('ascii') === '%PDF-') {
    mimeType = 'application/pdf';
    ext = 'pdf';
  } else {
    throw new Error('Unsupported file format. Only verified PNG, JPEG, and WebP images are permitted (SVG is blocked for security).');
  }

  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '');
  const fileId = 'fil-' + randomBytes(12).toString('hex');
  const relDir = path.join('.storage', 'uploads', safeTenant);
  const absDir = path.join(process.cwd(), relDir);
  await fs.mkdir(absDir, { recursive: true });

  const fileName = `${fileId}.${ext}`;
  const relFilePath = path.join(relDir, fileName).replace(/\\/g, '/');
  await fs.writeFile(path.join(absDir, fileName), buf);

  return {
    fileId,
    mimeType,
    ext,
    byteSize: buf.length,
    diskPath: relFilePath,
  };
}

// ---------- CSV Formula Injection Neutralizer ----------

export function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/^[=+\-@\t\r]/.test(s) && !/^-\d+(\.\d+)?$/.test(s)) {
    return `'${s}`;
  }
  return s;
}

