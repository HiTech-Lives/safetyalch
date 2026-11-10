import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { exec, one, audit, nowSql } from '@/lib/db';
import { verifySameOrigin, checkRateLimit, getClientIp } from '@/lib/security';
import { requireApiSession, apiErrorResponse } from '@/lib/session';
import { sendMail } from '@/lib/email';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const csrf = verifySameOrigin(req);
  if (!csrf.ok) return NextResponse.json({ error: csrf.error }, { status: 403 });

  const ip = getClientIp(req);
  const rl = checkRateLimit(`confirm-visit:${ip}`, 25, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many requests. Retry in ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  const { token } = await params;
  const body = await req.json();
  const action = body.action;

  if (action === 'send_confirmation') {
    try {
      const s = await requireApiSession(req);
      if (!s.permissions.has('team:inspections.execute') && !s.permissions.has('team:members.assign')) {
        return NextResponse.json({ error: 'Permission denied to send visit confirmations.' }, { status: 403 });
      }
      const visitId = String(body.visit_id || '');
      const v = await one<any>(
        `SELECT v.*, st.name AS site_name, m.name AS member_name
           FROM visits v
           JOIN sites st ON st.id = v.site_id
           JOIN members m ON m.id = st.member_id
          WHERE v.id=? AND v.tenant_id=?`,
        [visitId, s.tenantId]
      );
      if (!v) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

      const confirmToken =
        v.confirm_token && v.confirm_token.length >= 24
          ? v.confirm_token
          : 'confirm-' + randomBytes(16).toString('hex');
      await exec('UPDATE visits SET confirm_token=?, confirm_status="sent" WHERE id=? AND tenant_id=?', [
        confirmToken,
        visitId,
        s.tenantId,
      ]);

      const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
      const confirmUrl = `${appUrl}/confirm-visit/${confirmToken}`;
      if (v.site_contact_email) {
        await sendMail({
          to: v.site_contact_email,
          subject: `Please Confirm Upcoming Safety Visit: ${v.member_name} (${v.scheduled_for})`,
          text: `Hello ${v.site_contact_name || 'Site Contact'},\n\nPlease confirm your upcoming safety visit at ${v.site_name} on ${v.scheduled_for} (${v.start_time || '09:00 AM'}):\n${confirmUrl}`,
        });
      }
      await audit(s.tenantId, s.user.id, 'visit.confirmation_sent', 'visit', visitId, { confirmUrl }, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true, confirm_token: confirmToken, confirm_url: `/confirm-visit/${confirmToken}` });
    } catch (err) {
      return apiErrorResponse(err);
    }
  }

  if (!token || token.length < 12) {
    return NextResponse.json({ error: 'Invalid or expired confirmation link.' }, { status: 404 });
  }

  const visit = await one<any>('SELECT * FROM visits WHERE confirm_token=?', [token]);
  if (!visit) {
    return NextResponse.json({ error: 'Invalid or expired confirmation link.' }, { status: 404 });
  }

  if (action === 'confirm_there') {
    const name = String(body.name || visit.site_contact_name || 'Site Representative').trim().slice(0, 160);
    await exec(
      `UPDATE visits
          SET confirm_status='confirmed',
              confirmed_by_name=?,
              confirmed_at=?,
              confirm_notes='Confirmed: Someone will be on site to meet the consultant.'
        WHERE id=?`,
      [name, nowSql(), visit.id]
    );
    return NextResponse.json({ ok: true, status: 'confirmed' });
  }

  if (action === 'confirm_alternate') {
    const altName = String(body.alternate_name || visit.site_contact_name || '').trim().slice(0, 160);
    const altPhone = String(body.alternate_phone || visit.site_contact_phone || '').trim().slice(0, 60);
    const notes = String(body.notes || '').trim().slice(0, 500);
    await exec(
      `UPDATE visits
          SET confirm_status='confirmed',
              confirmed_by_name=?,
              confirmed_by_phone=?,
              confirmed_at=?,
              confirm_notes=?
        WHERE id=?`,
      [
        altName,
        altPhone,
        nowSql(),
        `Alternate site contact designated: ${altName} (${altPhone}). ${notes}`.trim(),
        visit.id,
      ]
    );
    return NextResponse.json({ ok: true, status: 'confirmed' });
  }

  if (action === 'reschedule') {
    const notes = String(body.notes || 'Requested a different visit time.').trim().slice(0, 500);
    await exec(
      `UPDATE visits
          SET confirm_status='reschedule_requested',
              confirmed_at=?,
              confirm_notes=?
        WHERE id=?`,
      [nowSql(), notes, visit.id]
    );
    return NextResponse.json({ ok: true, status: 'reschedule_requested' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
