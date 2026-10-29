import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSession } from '@/lib/session';
import { q, one, audit } from '@/lib/db';
import { crewIds } from '@/lib/queries';

export async function POST(req: Request) {
  const s = await getSession();
  const body = await req.json();
  const { action } = body as { action: string };
  const crew = await crewIds(s);

  if (action === 'create') {
    const siteId = String(body.siteId || '');
    const formCode = String(body.formCode || '').toUpperCase();
    const scheduledFor = String(body.scheduledFor || '').slice(0, 10);
    const leadUserId = body.leadUserId ? String(body.leadUserId) : null;
    const attendeeIds: string[] = Array.isArray(body.attendeeIds) ? body.attendeeIds : [];

    if (!siteId || !formCode || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledFor)) {
      return NextResponse.json({ error: 'Site, form, and date are required.' }, { status: 400 });
    }
    if (crew && leadUserId && !crew.includes(leadUserId)) {
      return NextResponse.json({ error: 'You can only schedule visits within your crew.' }, { status: 403 });
    }

    const site = await one<any>('SELECT st.id, st.name, m.name AS member_name FROM sites st JOIN members m ON m.id = st.member_id WHERE st.id=? AND m.tenant_id=?', [siteId, s.tenantId]);
    if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });

    const visitId = randomUUID();
    const origin = leadUserId === s.user.id ? 'self' : 'assigned';
    await q(
      'INSERT INTO visits (id, tenant_id, site_id, form_code, lead_user_id, scheduled_for, origin, created_by) VALUES (?,?,?,?,?,?,?,?)',
      [visitId, s.tenantId, siteId, formCode, leadUserId, scheduledFor, origin, s.user.id]
    );
    for (const attId of attendeeIds.filter(u => u && u !== leadUserId)) {
      await q('INSERT IGNORE INTO visit_attendees (visit_id, user_id) VALUES (?,?)', [visitId, attId]);
    }
    await audit(s.tenantId, s.user.id, 'visit.scheduled', 'visit', visitId, { siteId, formCode, scheduledFor, leadUserId, attendeeIds });
    return NextResponse.json({ ok: true, message: `Visit scheduled for ${site.member_name} · ${site.name}.`, visitId });
  }

  if (action === 'update') {
    const visitId = String(body.visitId || '');
    const scheduledFor = String(body.scheduledFor || '').slice(0, 10);
    const formCode = String(body.formCode || '').toUpperCase();
    const leadUserId = body.leadUserId ? String(body.leadUserId) : null;
    const attendeeIds: string[] = Array.isArray(body.attendeeIds) ? body.attendeeIds : [];

    const visit = await one<any>('SELECT * FROM visits WHERE id=? AND tenant_id=?', [visitId, s.tenantId]);
    if (!visit) return NextResponse.json({ error: 'Visit not found.' }, { status: 404 });
    if (crew && leadUserId && !crew.includes(leadUserId)) {
      return NextResponse.json({ error: 'You can only assign visits within your crew.' }, { status: 403 });
    }

    const origin = leadUserId === s.user.id && visit.origin === 'self' ? 'self' : 'assigned';
    await q('UPDATE visits SET scheduled_for=?, form_code=?, lead_user_id=?, origin=? WHERE id=?', [
      scheduledFor || visit.scheduled_for,
      formCode || visit.form_code,
      leadUserId,
      origin,
      visitId,
    ]);
    await q('DELETE FROM visit_attendees WHERE visit_id=?', [visitId]);
    for (const attId of attendeeIds.filter(u => u && u !== leadUserId)) {
      await q('INSERT IGNORE INTO visit_attendees (visit_id, user_id) VALUES (?,?)', [visitId, attId]);
    }
    await audit(s.tenantId, s.user.id, 'visit.updated', 'visit', visitId, { scheduledFor, formCode, leadUserId, attendeeIds });
    return NextResponse.json({ ok: true, message: 'Visit updated.' });
  }

  if (action === 'delete') {
    const visitId = String(body.visitId || '');
    const visit = await one<any>('SELECT * FROM visits WHERE id=? AND tenant_id=?', [visitId, s.tenantId]);
    if (!visit) return NextResponse.json({ error: 'Visit not found.' }, { status: 404 });
    await q('DELETE FROM visit_attendees WHERE visit_id=?', [visitId]);
    await q('DELETE FROM visits WHERE id=?', [visitId]);
    await audit(s.tenantId, s.user.id, 'visit.cancelled', 'visit', visitId);
    return NextResponse.json({ ok: true, message: 'Visit removed from schedule.' });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

