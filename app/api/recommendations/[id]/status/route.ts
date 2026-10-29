import { NextResponse } from 'next/server';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getSession, can } from '@/lib/session';
import { one, q, audit } from '@/lib/db';
import { canActOn, getTenant } from '@/lib/queries';
import { sendMail } from '@/lib/email';

// action -> [required current status, next status (null = unchanged), event kind, event note]
const ACTIONS: Record<string, [string, string | null, string, string]> = {
  confirm: ['pending', 'corrected', 'confirmed', 'Confirmed corrected by'],
  reject: ['pending', 'open', 'rejected', 'Not fixed. Reopened at original due date, Member notified, by'],
  mark_corrected: ['open', 'corrected', 'marked_corrected', 'Marked corrected by'],
  resend: ['open', null, 'link_resent', 'Sign-in link resent to the Member by'],
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  const body = (await req.json()) as { action: string; note?: string; text?: string };
  const { action } = body;

  const rec = await one<any>(
    `SELECT r.id, r.status, r.text, r.original_text, r.due_on, i.id AS inspection_id, i.consultant_id,
            st.member_id, m.name AS member_name, st.name AS site_name, u.email AS consultant_email
       FROM recommendations r
       JOIN inspections i ON i.id = r.inspection_id
       JOIN users u ON u.id = i.consultant_id
       JOIN sites st ON st.id = i.site_id
       JOIN members m ON m.id = st.member_id
      WHERE r.id=? AND r.tenant_id=?`,
    [id, s.tenantId]
  );
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await canActOn(s, rec.consultant_id))) return NextResponse.json({ error: 'Outside your scope' }, { status: 403 });

  if (action === 'add_note') {
    const note = String(body.note || '').trim();
    if (!note) return NextResponse.json({ error: 'Enter a note first.' }, { status: 400 });
    await q('INSERT INTO rec_events (rec_id, at, actor_user_id, kind, note) VALUES (?, NOW(), ?, ?, ?)', [
      id,
      s.user.id,
      'note',
      `Note by ${s.user.name}: ${note}`,
    ]);
    await audit(s.tenantId, s.user.id, 'rec.note_added', 'recommendation', id, { note });
    return NextResponse.json({ ok: true, message: `${id}: note added.` });
  }

  if (action === 'revise_wording') {
    if (!can.reviseWording(s)) {
      return NextResponse.json({ error: 'Only Owners, Admins, and Supervisors can revise finding wording.' }, { status: 403 });
    }
    const newText = String(body.text || '').trim();
    if (!newText) return NextResponse.json({ error: 'Recommendation wording cannot be empty.' }, { status: 400 });
    if (newText === rec.text) return NextResponse.json({ error: 'Wording is unchanged.' }, { status: 400 });

    const orig = rec.original_text || rec.text;
    await q('UPDATE recommendations SET text=?, original_text=?, revised_by=?, revised_at=NOW() WHERE id=?', [
      newText,
      orig,
      s.user.id,
      id,
    ]);
    await q('INSERT INTO rec_events (rec_id, at, actor_user_id, kind, note) VALUES (?, NOW(), ?, ?, ?)', [
      id,
      s.user.id,
      'wording_revised',
      `Wording revised by ${s.user.name}. Original text retained on file.`,
    ]);
    await audit(s.tenantId, s.user.id, 'rec.wording_revised', 'recommendation', id, { original: orig, revised: newText });

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
  if (rec.status !== spec[0]) return NextResponse.json({ error: 'This recommendation is ' + rec.status + ', not ' + spec[0] + '.' }, { status: 409 });

  if (spec[1]) await q('UPDATE recommendations SET status=? WHERE id=?', [spec[1], id]);
  await q('INSERT INTO rec_events (rec_id, at, actor_user_id, kind, note) VALUES (?, NOW(), ?, ?, ?)', [id, s.user.id, spec[2], spec[3] + ' ' + s.user.name + '.']);
  await audit(s.tenantId, s.user.id, 'rec.' + action, 'recommendation', id, { from: rec.status, to: spec[1] ?? rec.status });

  // On reject and resend, issue a fresh magic sign-in link for the Member's primary contact and send via on-server SMTP.
  if (action === 'reject' || action === 'resend') {
    const contact = await one<any>('SELECT id, name, email FROM member_contacts WHERE member_id=? AND is_primary=1 LIMIT 1', [rec.member_id]);
    if (contact?.email) {
      const rawToken = randomBytes(24).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 90 * 86400 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      await q(
        'INSERT INTO magic_links (id, contact_id, inspection_id, token_hash, expires_at) VALUES (?,?,?,?,?)',
        [randomUUID(), contact.id, rec.inspection_id, tokenHash, expiresAt]
      );
      const tenant = await getTenant(s);
      const appUrl = (process.env.APP_URL || 'https://safetyalchemist.com').replace(/\/$/, '');
      const linkUrl = `${appUrl}/portal/${rawToken}`;
      const useBrand = tenant.brand_scopes?.email;
      await sendMail({
        to: contact.email,
        fromName: useBrand ? tenant.name : 'The Safety Alchemist',
        fromAddress: useBrand && tenant.email_sender ? tenant.email_sender : undefined,
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
}
