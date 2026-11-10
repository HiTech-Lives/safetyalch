import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireApiSession, can, apiErrorResponse } from '@/lib/session';
import { one, q, audit, nowSql } from '@/lib/db';
import { canActOn, getTenant } from '@/lib/queries';
import { generateOpaqueToken, sha256Hex } from '@/lib/security';
import { sendMail } from '@/lib/email';

const ACTIONS: Record<string, [string, string | null, string, string]> = {
  confirm: ['pending', 'corrected', 'confirmed', 'Confirmed corrected by'],
  reject: ['pending', 'open', 'rejected', 'Not fixed. Reopened at original due date, Member notified, by'],
  mark_corrected: ['open', 'corrected', 'marked_corrected', 'Marked corrected by'],
  resend: ['open', null, 'link_resent', 'Sign-in link resent to the Member by'],
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await requireApiSession(req);
    const body = (await req.json()) as { action: string; note?: string; text?: string };
    const { action } = body;

    const rec = await one<any>(
      `SELECT r.id, r.status, r.text, r.original_text, r.due_on, i.id AS inspection_id, i.consultant_id,
              st.member_id, m.group_id, m.name AS member_name, st.name AS site_name, u.email AS consultant_email
         FROM recommendations r
         JOIN inspections i ON i.id = r.inspection_id
         JOIN users u ON u.id = i.consultant_id
         JOIN sites st ON st.id = i.site_id
         JOIN members m ON m.id = st.member_id
        WHERE r.id=? AND r.tenant_id=?`,
      [id, s.tenantId]
    );
    if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!(await canActOn(s, rec.consultant_id))) return NextResponse.json({ error: 'Outside your crew scope' }, { status: 403 });
    if (s.groupScopes.length && (!rec.group_id || !s.groupScopes.includes(rec.group_id))) {
      return NextResponse.json({ error: 'Outside your portfolio group scope' }, { status: 403 });
    }

    if (action === 'add_note') {
      const note = String(body.note || '').trim().slice(0, 2000);
      if (!note) return NextResponse.json({ error: 'Enter a note first.' }, { status: 400 });
      await q('INSERT INTO rec_events (rec_id, at, actor_user_id, kind, note) VALUES (?, ?, ?, ?, ?)', [
        id,
        nowSql(),
        s.user.id,
        'note',
        `Note by ${s.user.name}: ${note}`,
      ]);
      await audit(s.tenantId, s.user.id, 'rec.note_added', 'recommendation', id, { note }, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true, message: `${id}: note added.` });
    }

    if (action === 'revise_wording') {
      if (!can.reviseWording(s)) {
        return NextResponse.json({ error: 'Missing team:qc.approve permission to revise finding wording.' }, { status: 403 });
      }
      const newText = String(body.text || '').trim();
      if (!newText) return NextResponse.json({ error: 'Recommendation wording cannot be empty.' }, { status: 400 });
      if (newText === rec.text) return NextResponse.json({ error: 'Wording is unchanged.' }, { status: 400 });

      const orig = rec.original_text || rec.text;
      await q('UPDATE recommendations SET text=?, original_text=?, revised_by=?, revised_at=? WHERE id=? AND tenant_id=?', [
        newText,
        orig,
        s.user.id,
        nowSql(),
        id,
        s.tenantId,
      ]);
      await q('INSERT INTO rec_events (rec_id, at, actor_user_id, kind, note) VALUES (?, ?, ?, ?, ?)', [
        id,
        nowSql(),
        s.user.id,
        'wording_revised',
        `Wording revised by ${s.user.name}. Original text retained on file.`,
      ]);
      await audit(
        s.tenantId,
        s.user.id,
        'rec.wording_revised',
        'recommendation',
        id,
        { original: orig, revised: newText },
        s.impersonation?.platformUserId
      );

      if (rec.consultant_email && rec.consultant_id !== s.user.id) {
        await sendMail({
          to: rec.consultant_email,
          subject: `Finding ${id} wording revised by ${s.user.name}`,
          text: `${s.user.name} revised the wording of finding ${id} (${rec.member_name} · ${rec.site_name}).\n\nOriginal: ${orig}\nRevised: ${newText}`,
        });
      }
      return NextResponse.json({ ok: true, message: `${id}: wording revised and logged.` });
    }

    const spec = ACTIONS[action];
    if (!spec) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    if (rec.status !== spec[0]) {
      return NextResponse.json({ error: 'This recommendation is ' + rec.status + ', not ' + spec[0] + '.' }, { status: 409 });
    }

    if (spec[1]) await q('UPDATE recommendations SET status=? WHERE id=? AND tenant_id=?', [spec[1], id, s.tenantId]);
    await q('INSERT INTO rec_events (rec_id, at, actor_user_id, kind, note) VALUES (?, ?, ?, ?, ?)', [
      id,
      nowSql(),
      s.user.id,
      spec[2],
      spec[3] + ' ' + s.user.name + '.',
    ]);
    await audit(
      s.tenantId,
      s.user.id,
      'rec.' + action,
      'recommendation',
      id,
      { from: rec.status, to: spec[1] ?? rec.status },
      s.impersonation?.platformUserId
    );

    if (action === 'reject' || action === 'resend') {
      const contact = await one<any>('SELECT id, name, email FROM member_contacts WHERE member_id=? AND is_primary=1 LIMIT 1', [
        rec.member_id,
      ]);
      if (contact?.email) {
        const rawToken = generateOpaqueToken();
        const tokenHash = sha256Hex(rawToken);
        const expiresAt = nowSql(90 * 86400 * 1000);
        await q('INSERT INTO magic_links (id, contact_id, inspection_id, token_hash, expires_at) VALUES (?,?,?,?,?)', [
          randomUUID(),
          contact.id,
          rec.inspection_id,
          tokenHash,
          expiresAt,
        ]);
        const tenant = await getTenant(s);
        const appUrl = (process.env.APP_URL || 'https://safetyalchemist.com').replace(/\/$/, '');
        const linkUrl = `${appUrl}/portal/${rawToken}`;
        const useBrand = tenant.brand_scopes?.email;
        const verifiedFrom = useBrand && tenant.email_sender_verified && tenant.email_sender ? tenant.email_sender : undefined;
        await sendMail({
          to: contact.email,
          fromName: useBrand ? tenant.name : 'The Safety Alchemist',
          fromAddress: verifiedFrom,
          subject:
            action === 'reject'
              ? `[Action Required] Finding ${rec.id} reopened (${rec.member_name} · ${rec.site_name})`
              : `Inspection correction link for ${rec.member_name} (${rec.site_name})`,
          text: [
            `Hello ${contact.name},`,
            '',
            action === 'reject'
              ? `Finding ${rec.id} ("${rec.text}") remains open and requires additional corrective action.`
              : `Here is your sign-in link to review and submit corrections for ${rec.member_name} · ${rec.site_name}:`,
            '',
            linkUrl,
            '',
            `Due date: ${rec.due_on}`,
          ].join('\n'),
        });
      }
    }

    return NextResponse.json({ ok: true, message: id + ': ' + spec[3].replace(/ by$/, '').toLowerCase() + '.' });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
