import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { exec, one } from '@/lib/db';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json();
  const action = body.action;

  if (action === 'send_confirmation') {
    const visitId = String(body.visit_id || '');
    const v = await one<any>('SELECT * FROM visits WHERE id=?', [visitId]);
    if (!v) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    const confirmToken = v.confirm_token || 'confirm-' + randomBytes(6).toString('hex');
    await exec('UPDATE visits SET confirm_token=?, confirm_status="sent" WHERE id=?', [confirmToken, visitId]);
    return NextResponse.json({ ok: true, confirm_token: confirmToken });
  }

  const visit = await one<any>('SELECT * FROM visits WHERE confirm_token=?', [token]);
  if (!visit) {
    return NextResponse.json({ error: 'Invalid or expired confirmation link.' }, { status: 404 });
  }

  if (action === 'confirm_there') {
    await exec(
      `UPDATE visits
          SET confirm_status='confirmed',
              confirmed_by_name=COALESCE(?, site_contact_name, 'Site Representative'),
              confirmed_at=NOW(),
              confirm_notes='Confirmed: Someone will be on site to meet the consultant.'
        WHERE id=?`,
      [body.name || visit.site_contact_name, visit.id]
    );
    return NextResponse.json({ ok: true, status: 'confirmed' });
  }

  if (action === 'confirm_alternate') {
    await exec(
      `UPDATE visits
          SET confirm_status='confirmed',
              confirmed_by_name=?,
              confirmed_by_phone=?,
              confirmed_at=NOW(),
              confirm_notes=?
        WHERE id=?`,
      [
        body.alternate_name || visit.site_contact_name,
        body.alternate_phone || visit.site_contact_phone,
        `Alternate site contact designated: ${body.alternate_name} (${body.alternate_phone || ''}). ${body.notes || ''}`.trim(),
        visit.id,
      ]
    );
    return NextResponse.json({ ok: true, status: 'confirmed' });
  }

  if (action === 'reschedule') {
    await exec(
      `UPDATE visits
          SET confirm_status='reschedule_requested',
              confirmed_at=NOW(),
              confirm_notes=?
        WHERE id=?`,
      [body.notes || 'Requested a different visit time.', visit.id]
    );
    return NextResponse.json({ ok: true, status: 'reschedule_requested' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

