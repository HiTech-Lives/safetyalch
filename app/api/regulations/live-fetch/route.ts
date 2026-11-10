import { NextResponse } from 'next/server';
import { q, one, nowSql } from '@/lib/db';
import {
  assertSafeOutboundUrl,
  OFFICIAL_REGULATION_HOST_SUFFIXES,
  verifySameOrigin,
  checkRateLimit,
  getClientIp,
} from '@/lib/security';
import { getOptionalSession, getOptionalPlatformSession } from '@/lib/session';

function htmlToCleanText(html: string): { title: string; excerpt: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(br|p|div|li|tr|h1|h2|h3|h4|h5|h6|section|article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&sect;|&#167;/gi, '§')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

  return {
    title: rawTitle.slice(0, 240),
    excerpt: stripped.slice(0, 12000),
  };
}

async function fetchAllowlistedGovUrl(initialUrl: string): Promise<{
  finalUrl: string;
  status: number;
  lastModified: string | null;
  contentType: string;
  bodyText: string;
}> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop <= 3; hop++) {
    const validated = await assertSafeOutboundUrl(currentUrl, {
      allowedHostSuffixes: OFFICIAL_REGULATION_HOST_SUFFIXES,
    });

    const res = await fetch(validated.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'SafetyAlchemist-ComplianceVerifier/0.0.3 (+https://safetyalchemist.com)',
        Accept: 'text/html,application/xhtml+xml,application/json,text/plain;q=0.9',
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error(`Redirect (${res.status}) missing Location header.`);
      currentUrl = new URL(loc, validated).toString();
      continue;
    }

    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    const maxBytes = 1.5 * 1024 * 1024; // 1.5 MB cap
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > maxBytes) {
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }
    }
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const bodyText = decoder.decode(Buffer.concat(chunks));

    return {
      finalUrl: validated.toString(),
      status: res.status,
      lastModified: res.headers.get('last-modified'),
      contentType: res.headers.get('content-type') || 'text/html',
      bodyText,
    };
  }
  throw new Error('Too many redirects from regulatory source.');
}

export async function POST(req: Request) {
  const csrf = verifySameOrigin(req);
  if (!csrf.ok) return NextResponse.json({ error: csrf.error }, { status: 403 });

  const [teamSess, platSess] = await Promise.all([getOptionalSession(), getOptionalPlatformSession()]);
  if (!teamSess && !platSess) {
    return NextResponse.json({ error: 'Authentication required to fetch live regulatory sources.' }, { status: 401 });
  }

  const rateKey = `reg-fetch:${platSess?.platformUserId || teamSess?.user.id || getClientIp(req)}`;
  const rl = checkRateLimit(rateKey, 20, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Rate limit reached. Retry in ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  try {
    const body = await req.json();
    let targetUrl = String(body.url || '').trim();
    const portalCode = body.portalCode ? String(body.portalCode).trim() : null;
    const regId = body.regId ? String(body.regId).trim() : null;

    if (!targetUrl && portalCode) {
      const p = await one<any>('SELECT standards_url, portal_url FROM jurisdiction_portals WHERE code=?', [portalCode]);
      targetUrl = p?.standards_url || p?.portal_url || '';
    }
    if (!targetUrl && regId) {
      const r = await one<any>('SELECT source_url FROM regulations WHERE reg_id=?', [regId]);
      targetUrl = r?.source_url || '';
    }

    if (!targetUrl) {
      return NextResponse.json({ error: 'Target official regulatory URL is required.' }, { status: 400 });
    }

    const fetched = await fetchAllowlistedGovUrl(targetUrl);
    const { title, excerpt } = htmlToCleanText(fetched.bodyText);
    const checkedAt = nowSql();

    if (portalCode) {
      await q('UPDATE jurisdiction_portals SET last_verified_at=?, last_http_status=? WHERE code=?', [
        checkedAt,
        fetched.status,
        portalCode,
      ]);
    }
    if (regId) {
      await q('UPDATE regulations SET last_live_checked_at=?, live_http_status=? WHERE reg_id=?', [
        checkedAt,
        fetched.status,
        regId,
      ]);
    }

    return NextResponse.json({
      ok: fetched.status >= 200 && fetched.status < 400,
      status: fetched.status,
      finalUrl: fetched.finalUrl,
      checkedAt,
      lastModified: fetched.lastModified,
      title: title || fetched.finalUrl,
      excerpt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Live regulatory fetch failed.' }, { status: 400 });
  }
}

