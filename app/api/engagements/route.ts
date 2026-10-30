import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getSession } from '@/lib/session';
import { exec } from '@/lib/db';

export async function POST(req: Request) {
  const s = await getSession();
  const body = await req.json();
  const action = body.action;

  if (action === 'create_engagement') {
    const id = 'eng-' + randomBytes(4).toString('hex');
    const budget = Number(body.annual_budget || 45000);
    await exec(
      `INSERT INTO engagements
        (id, tenant_id, source_id, referral_source_id, member_id, title, billing_model,
         annual_budget, spent_to_date, planned_amount, billed_amount,
         deliverables_total, deliverables_done, start_date, end_date, status, last_activity_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 0, ?, ?, 'on_pace', NOW(), ?)`,
      [
        id,
        s.tenantId,
        body.source_id || null,
        body.referral_source_id || null,
        body.member_id || null,
        body.title || 'Annual Loss Control Program',
        body.billing_model || 'drawdown',
        budget,
        budget,
        Number(body.deliverables_total || 12),
        body.start_date || new Date().toISOString().slice(0, 10),
        body.end_date || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        body.notes || null,
      ]
    );
    await exec(
      `INSERT INTO engagement_service_lines
        (id, engagement_id, service_name, unit_type, planned_count, done_count, rate_each, planned_total, spent_total, sort_order)
       VALUES (?, ?, 'Member risk control surveys', 'fixed_fee', ?, 0, 1950, ?, 0, 1)`,
      ['esl-' + randomBytes(4).toString('hex'), id, Number(body.deliverables_total || 12), budget]
    );
    return NextResponse.json({ ok: true, id });
  }

  if (action === 'log_activity') {
    const id = String(body.id);
    const note = String(body.note || '').trim();
    await exec(
      `UPDATE engagements
          SET last_activity_at = NOW(),
              status = 'on_pace',
              notes = CONCAT(COALESCE(notes, ''), '\n[', DATE_FORMAT(NOW(), '%Y-%m-%d'), '] ', ?)
        WHERE id=? AND tenant_id=?`,
      [note, id, s.tenantId]
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'create_source') {
    const id = 'src-' + randomBytes(4).toString('hex');
    await exec(
      'INSERT INTO sources (id, tenant_id, name, source_type, contact_name, contact_email) VALUES (?, ?, ?, ?, ?, ?)',
      [id, s.tenantId, body.name, body.source_type || 'captive', body.contact_name || null, body.contact_email || null]
    );
    if (body.referral_name) {
      await exec(
        'INSERT INTO referral_sources (id, tenant_id, source_id, name, contact_name, contact_email) VALUES (?, ?, ?, ?, ?, ?)',
        [
          'ref-' + randomBytes(4).toString('hex'),
          s.tenantId,
          id,
          body.referral_name,
          body.referral_contact || null,
          body.referral_email || null,
        ]
      );
    }
    return NextResponse.json({ ok: true, id });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

