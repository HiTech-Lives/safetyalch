import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { q, one, audit, nowSql } from '@/lib/db';
import {
  generateOpaqueToken,
  sha256Hex,
  verifySameOrigin,
  checkRateLimit,
  getClientIp,
  validateAndStoreUpload,
} from '@/lib/security';
import {
  PORTAL_SESSION_COOKIE,
  getOptionalPortalSession,
  sessionCookieOptions,
} from '@/lib/session';

async function resolveAuthenticatedPortalContact(token: string) {
  // 1. Check active portal session cookie if caller passed token='session' or matching member
  const portalSess = await getOptionalPortalSession();
  if (token === 'session' && portalSess) {
    const member = await one<{ name: string }>('SELECT name FROM members WHERE id=?', [portalSess.memberId]);
    return {
      ml_id: null,
      contact_id: portalSess.contactId,
      contact_name: portalSess.contactName,
      contact_email: portalSess.contactEmail,
      member_id: portalSess.memberId,
      member_name: member?.name || 'Member',
      tenant_id: portalSess.tenantId,
      hasCookie: true,
    };
  }

  // 2. Strictly require cryptographic magic link token (NO raw member ID fallback!)
  if (!token || token.length < 32) return null;
  const th = sha256Hex(token);
  const ml = await one<any>(
    `SELECT ml.id AS ml_id, c.id AS contact_id, c.name AS contact_name, c.email AS contact_email,
            m.id AS member_id, m.name AS member_name, m.tenant_id
       FROM magic_links ml
       JOIN member_contacts c ON c.id = ml.contact_id
       JOIN members m ON m.id = c.member_id
      WHERE ml.token_hash = ? AND ml.expires_at > ?`,
    [th, nowSql()]
  );
  if (!ml) return null;
  return { ...ml, hasCookie: Boolean(portalSess && portalSess.contactId === ml.contact_id) };
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const csrf = verifySameOrigin(req);
  if (!csrf.ok) return NextResponse.json({ error: csrf.error }, { status: 403 });

  const ip = getClientIp(req);
  const rl = checkRateLimit(`portal:${ip}`, 30, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many requests. Retry in ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  const { token } = await params;
  const ctx = await resolveAuthenticatedPortalContact(token);
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid or expired Member Portal link. Request a fresh magic link.' }, { status: 403 });
  }

  // Mint HTTP-only portal session cookie on first interaction with a valid magic link
  if (!ctx.hasCookie) {
    const jar = await cookies();
    const rawPortal = generateOpaqueToken();
    await q(
      `INSERT INTO portal_sessions (id, contact_id, member_id, tenant_id, token_hash, expires_at)
       VALUES (?,?,?,?,?,?)`,
      [randomUUID(), ctx.contact_id, ctx.member_id, ctx.tenant_id, sha256Hex(rawPortal), nowSql(30 * 86400 * 1000)]
    );
    if (ctx.ml_id) {
      await q('UPDATE magic_links SET used_at = COALESCE(used_at, ?) WHERE id=?', [nowSql(), ctx.ml_id]);
    }
    jar.set(PORTAL_SESSION_COOKIE, rawPortal, sessionCookieOptions(30 * 86400));
  }

  const body = await req.json();
  const { action, recId } = body as { action: string; recId?: string };

  if (action === 'exchange_session') {
    return NextResponse.json({ ok: true, memberId: ctx.member_id, contactName: ctx.contact_name });
  }

  if (!recId) {
    return NextResponse.json({ error: 'Recommendation ID is required.' }, { status: 400 });
  }

  const rec = await one<any>(
    `SELECT r.*, st.member_id
       FROM recommendations r
       JOIN inspections i ON i.id = r.inspection_id
       JOIN sites st ON st.id = i.site_id
      WHERE r.id = ? AND st.member_id = ? AND r.tenant_id = ?`,
    [recId, ctx.member_id, ctx.tenant_id]
  );
  if (!rec) {
    return NextResponse.json({ error: 'Recommendation not found for this Member.' }, { status: 404 });
  }

  if (action === 'submit_fix') {
    const note = String(body.note || '').trim().slice(0, 2000);
    const photoDataUrl = String(body.photoDataUrl || '').trim();
    if (!note) {
      return NextResponse.json({ error: 'Please describe the corrective action taken.' }, { status: 400 });
    }

    let savedUrl: string | null = null;
    if (photoDataUrl.startsWith('data:image/')) {
      const m = photoDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!m) {
        return NextResponse.json({ error: 'Malformed image upload.' }, { status: 400 });
      }
      const rawBuf = Buffer.from(m[2], 'base64');
      const fileObj = new File([rawBuf], `correction-${rec.id}`, { type: m[1] });
      let validated;
      try {
        validated = await validateAndStoreUpload(fileObj, ctx.tenant_id, { maxBytes: 8 * 1024 * 1024 });
      } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Invalid image file.' }, { status: 400 });
      }

      await q(
        `INSERT INTO stored_files (id, tenant_id, member_id, inspection_id, mime_type, byte_size, disk_path, original_name, uploaded_by_contact)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          validated.fileId,
          ctx.tenant_id,
          ctx.member_id,
          rec.inspection_id,
          validated.mimeType,
          validated.byteSize,
          validated.diskPath,
          `correction-${rec.id}.${validated.ext}`,
          ctx.contact_id,
        ]
      );
      savedUrl = `/api/files/${validated.fileId}`;

      await q(
        `INSERT INTO photos (id, tenant_id, inspection_id, rec_id, kind, storage_key, captured_at, uploaded_by_contact)
         VALUES (?,?,?,?,'correction',?,?,?)`,
        [randomUUID(), ctx.tenant_id, rec.inspection_id, rec.id, savedUrl, nowSql(), ctx.contact_id]
      );
    }

    await q("UPDATE recommendations SET status='pending', member_response='agree', member_response_note=? WHERE id=?", [
      note,
      rec.id,
    ]);
    const evNote = `${ctx.contact_name} submitted a correction from the Member Portal: "${note}"${savedUrl ? ' (verified photo attached)' : ''}.`;
    await q(
      'INSERT INTO rec_events (rec_id, at, actor_contact_id, kind, note) VALUES (?, ?, ?, "member_submitted", ?)',
      [rec.id, nowSql(), ctx.contact_id, evNote]
    );
    await audit(ctx.tenant_id, null, 'portal.submit_fix', 'recommendation', rec.id, {
      contact: ctx.contact_name,
      note,
      photo: savedUrl,
    });
    return NextResponse.json({ ok: true, message: `Correction for ${rec.id} submitted for Consultant review.` });
  }

  if (action === 'respond_rec') {
    const response = body.memberResponse === 'disagree' ? 'disagree' : 'agree';
    const responseNote = String(body.note || '').trim().slice(0, 2000);
    if (response === 'disagree' && !responseNote) {
      return NextResponse.json({ error: 'Please provide an explanation when disagreeing on the 30-Day Response Form.' }, { status: 400 });
    }
    await q('UPDATE recommendations SET member_response=?, member_response_note=? WHERE id=?', [
      response,
      responseNote || null,
      rec.id,
    ]);
    await q(
      'INSERT INTO rec_events (rec_id, at, actor_contact_id, kind, note) VALUES (?, ?, ?, "member_response", ?)',
      [
        rec.id,
        nowSql(),
        ctx.contact_id,
        `${ctx.contact_name} recorded 30-Day Board Response: ${response.toUpperCase()}${responseNote ? ` — "${responseNote}"` : ''}.`,
      ]
    );
    await audit(ctx.tenant_id, null, 'portal.respond_rec', 'recommendation', rec.id, {
      contact: ctx.contact_name,
      response,
      responseNote,
    });
    return NextResponse.json({ ok: true, message: `30-Day Response (${response.toUpperCase()}) recorded for ${rec.rec_number || rec.id}.` });
  }

  if (action === 'assume_risk') {
    const reason = String(body.reason || '').trim().slice(0, 2000);
    const signer = String(body.signer || ctx.contact_name).trim().slice(0, 160);
    if (!reason || !signer) {
      return NextResponse.json({ error: 'Written justification and signer name are required to assume risk.' }, { status: 400 });
    }

    await q("UPDATE recommendations SET status='assumed', member_response='disagree', member_response_note=? WHERE id=?", [
      reason,
      rec.id,
    ]);
    const evNote = `Risk assumed in writing by ${signer}: "${reason}"`;
    await q(
      'INSERT INTO rec_events (rec_id, at, actor_contact_id, kind, note) VALUES (?, ?, ?, "risk_assumed", ?)',
      [rec.id, nowSql(), ctx.contact_id, evNote]
    );
    await audit(ctx.tenant_id, null, 'portal.assume_risk', 'recommendation', rec.id, { signer, reason });
    return NextResponse.json({ ok: true, message: `Risk assumption recorded for ${rec.id}.` });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
