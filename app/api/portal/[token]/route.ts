import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { q, one, audit } from '@/lib/db';
import { hashToken } from '@/lib/auth';

async function resolvePortalContact(token: string) {
  const th = hashToken(token);
  const ml = await one<any>(
    `SELECT ml.id AS ml_id, c.id AS contact_id, c.name AS contact_name, c.email AS contact_email,
            m.id AS member_id, m.name AS member_name, m.tenant_id
       FROM magic_links ml
       JOIN member_contacts c ON c.id = ml.contact_id
       JOIN members m ON m.id = c.member_id
      WHERE ml.token_hash = ? AND ml.expires_at > NOW()`,
    [th]
  );
  if (ml) return ml;

  // Fallback for direct member ID preview (e.g. /portal/m1)
  const direct = await one<any>(
    `SELECT c.id AS contact_id, c.name AS contact_name, c.email AS contact_email,
            m.id AS member_id, m.name AS member_name, m.tenant_id
       FROM member_contacts c
       JOIN members m ON m.id = c.member_id
      WHERE m.id = ? AND c.is_primary = 1 LIMIT 1`,
    [token]
  );
  return direct;
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await resolvePortalContact(token);
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid or expired Member Portal link.' }, { status: 403 });
  }

  const body = await req.json();
  const { action, recId } = body as { action: string; recId: string };

  const rec = await one<any>(
    `SELECT r.*, st.member_id
       FROM recommendations r
       JOIN inspections i ON i.id = r.inspection_id
       JOIN sites st ON st.id = i.site_id
      WHERE r.id = ? AND st.member_id = ?`,
    [recId, ctx.member_id]
  );
  if (!rec) {
    return NextResponse.json({ error: 'Recommendation not found for this Member.' }, { status: 404 });
  }

  if (action === 'submit_fix') {
    const note = String(body.note || '').trim();
    const photoDataUrl = String(body.photoDataUrl || '').trim();
    if (!note) {
      return NextResponse.json({ error: 'Please describe the corrective action taken.' }, { status: 400 });
    }

    let savedPath: string | null = null;
    if (photoDataUrl.startsWith('data:image/')) {
      const m = photoDataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (m) {
        const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
        const buf = Buffer.from(m[2], 'base64');
        const fileName = `fix-${rec.id}-${Date.now()}.${ext}`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'photos');
        await fs.mkdir(uploadDir, { recursive: true });
        await fs.writeFile(path.join(uploadDir, fileName), buf);
        savedPath = `/uploads/photos/${fileName}`;

        await q(
          `INSERT INTO photos (id, tenant_id, inspection_id, rec_id, kind, storage_key, captured_at, uploaded_by_contact)
           VALUES (?,?,?,?,'correction',?,NOW(),?)`,
          [randomUUID(), ctx.tenant_id, rec.inspection_id, rec.id, savedPath, ctx.contact_id]
        );
      }
    }

    await q("UPDATE recommendations SET status='pending' WHERE id=?", [rec.id]);
    const evNote = `${ctx.contact_name} submitted a correction from the Member Portal: "${note}"${savedPath ? ' (photo attached)' : ''}.`;
    await q(
      'INSERT INTO rec_events (rec_id, at, actor_contact_id, kind, note) VALUES (?, NOW(), ?, "member_submitted", ?)',
      [rec.id, ctx.contact_id, evNote]
    );
    await audit(ctx.tenant_id, null, 'portal.submit_fix', 'recommendation', rec.id, { contact: ctx.contact_name, note, photo: savedPath });
    return NextResponse.json({ ok: true, message: `Correction for ${rec.id} submitted for Consultant review.` });
  }

  if (action === 'assume_risk') {
    const reason = String(body.reason || '').trim();
    const signer = String(body.signer || ctx.contact_name).trim();
    if (!reason || !signer) {
      return NextResponse.json({ error: 'Written justification and signer name are required to assume risk.' }, { status: 400 });
    }

    await q("UPDATE recommendations SET status='assumed' WHERE id=?", [rec.id]);
    const evNote = `Risk assumed in writing by ${signer}: "${reason}"`;
    await q(
      'INSERT INTO rec_events (rec_id, at, actor_contact_id, kind, note) VALUES (?, NOW(), ?, "risk_assumed", ?)',
      [rec.id, ctx.contact_id, evNote]
    );
    await audit(ctx.tenant_id, null, 'portal.assume_risk', 'recommendation', rec.id, { signer, reason });
    return NextResponse.json({ ok: true, message: `Risk assumption recorded for ${rec.id}.` });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

