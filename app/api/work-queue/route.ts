import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getSession } from '@/lib/session';
import { exec, one } from '@/lib/db';

export async function POST(req: Request) {
  const s = await getSession();
  const body = await req.json();
  const action = body.action;

  if (action === 'create_job') {
    const id = 'J-' + Math.floor(1012 + Math.random() * 8900);
    let memberId = body.member_id || null;
    let siteId = body.site_id || null;
    const insuredName = String(body.insured_name || 'New Policyholder').trim();
    const siteAddress = String(body.site_address || '').trim();

    // Auto-create member & site if not already selected
    if (!memberId) {
      const existingMember = await one<{ id: string }>('SELECT id FROM members WHERE tenant_id=? AND name=? LIMIT 1', [
        s.tenantId,
        insuredName,
      ]);
      if (existingMember) {
        memberId = existingMember.id;
      } else {
        memberId = 'm-' + randomBytes(4).toString('hex');
        await exec('INSERT INTO members (id, tenant_id, name, industry, city) VALUES (?, ?, ?, ?, ?)', [
          memberId,
          s.tenantId,
          insuredName,
          'Construction',
          siteAddress.split(',')[1]?.trim() || 'Sacramento, CA',
        ]);
        if (body.site_contact) {
          await exec(
            'INSERT INTO member_contacts (id, member_id, name, email, is_primary) VALUES (?, ?, ?, ?, 1)',
            ['c-' + memberId, memberId, body.site_contact, body.contact_email || 'contact@example.com']
          );
        }
      }
    }

    if (!siteId && memberId) {
      const existingSite = await one<{ id: string }>('SELECT id FROM sites WHERE member_id=? LIMIT 1', [memberId]);
      if (existingSite) {
        siteId = existingSite.id;
      } else {
        siteId = 's-' + randomBytes(4).toString('hex');
        await exec('INSERT INTO sites (id, member_id, name, address, jurisdiction) VALUES (?, ?, ?, ?, ?)', [
          siteId,
          memberId,
          siteAddress || insuredName + ' Primary Site',
          siteAddress || insuredName,
          'CA',
        ]);
      }
    }

    let engagementId = body.engagement_id || null;
    let sourceId = body.source_id || null;
    let referralId = body.referral_source_id || null;
    if (engagementId) {
      const eng = await one<any>('SELECT source_id, referral_source_id FROM engagements WHERE id=?', [engagementId]);
      if (eng) {
        sourceId = sourceId || eng.source_id;
        referralId = referralId || eng.referral_source_id;
      }
    }

    const assignedTo = body.assigned_to || null;
    const visitDate = body.visit_scheduled_date || null;
    const status = body.status || (visitDate ? 'scheduled' : 'received');
    let visitId: string | null = null;

    if (visitDate && siteId) {
      visitId = 'v-' + randomBytes(4).toString('hex');
      const confirmToken = 'confirm-' + randomBytes(6).toString('hex');
      await exec(
        `INSERT INTO visits
          (id, tenant_id, site_id, form_code, lead_user_id, scheduled_for, start_time, duration_minutes, origin,
           site_contact_name, site_contact_phone, site_contact_email, confirm_token, confirm_status, job_id, created_by)
         VALUES (?, ?, ?, 'CFA', ?, ?, '09:00 AM', 120, 'assigned', ?, ?, ?, ?, 'unconfirmed', ?, ?)`,
        [
          visitId,
          s.tenantId,
          siteId,
          assignedTo,
          visitDate,
          body.site_contact || null,
          body.contact_phone || null,
          body.contact_email || null,
          confirmToken,
          id,
          s.user.id,
        ]
      );
    }

    await exec(
      `INSERT INTO work_jobs
        (id, tenant_id, engagement_id, source_id, referral_source_id, member_id, site_id,
         title, carrier_ref, service_type, insured_name, requested_by, site_address,
         site_contact, contact_phone, contact_email, fee, status, billed, assigned_to,
         received_date, due_date, visit_scheduled_date, notes, raw_email_text, visit_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        s.tenantId,
        engagementId,
        sourceId,
        referralId,
        memberId,
        siteId,
        body.title || `${body.service_type || 'Loss Control Survey'}: ${insuredName}`,
        body.carrier_ref || null,
        body.service_type || 'Member risk control survey',
        insuredName,
        body.requested_by || null,
        siteAddress || null,
        body.site_contact || null,
        body.contact_phone || null,
        body.contact_email || null,
        Number(body.fee || 1850),
        status,
        assignedTo,
        body.received_date || new Date().toISOString().slice(0, 10),
        body.due_date || null,
        visitDate,
        body.notes || null,
        body.raw_email_text || null,
        visitId,
      ]
    );

    return NextResponse.json({ ok: true, id, visitId });
  }

  if (action === 'update_status') {
    const jobId = String(body.id);
    const nextStatus = String(body.status);
    await exec('UPDATE work_jobs SET status=? WHERE id=? AND tenant_id=?', [nextStatus, jobId, s.tenantId]);
    if (nextStatus === 'delivered') {
      const job = await one<any>('SELECT engagement_id FROM work_jobs WHERE id=? AND tenant_id=?', [jobId, s.tenantId]);
      if (job?.engagement_id) {
        await exec(
          'UPDATE engagements SET deliverables_done = LEAST(deliverables_total, deliverables_done + 1), last_activity_at = NOW() WHERE id=?',
          [job.engagement_id]
        );
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'assign_inspector') {
    const jobId = String(body.id);
    const userId = body.assigned_to || null;
    await exec('UPDATE work_jobs SET assigned_to=?, status=IF(status="received","scheduled",status) WHERE id=? AND tenant_id=?', [
      userId,
      jobId,
      s.tenantId,
    ]);
    await exec('UPDATE visits SET lead_user_id=? WHERE job_id=? AND tenant_id=?', [userId, jobId, s.tenantId]);
    return NextResponse.json({ ok: true });
  }

  if (action === 'bill_job') {
    const jobId = String(body.id);
    const job = await one<any>('SELECT * FROM work_jobs WHERE id=? AND tenant_id=?', [jobId, s.tenantId]);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    await exec('UPDATE work_jobs SET billed=1, billed_at=NOW() WHERE id=? AND tenant_id=?', [jobId, s.tenantId]);
    if (job.engagement_id) {
      await exec(
        `UPDATE engagements
            SET spent_to_date = spent_to_date + ?,
                billed_amount = billed_amount + ?,
                planned_amount = GREATEST(0, planned_amount - ?),
                last_activity_at = NOW()
          WHERE id=? AND tenant_id=?`,
        [Number(job.fee), Number(job.fee), Number(job.fee), job.engagement_id, s.tenantId]
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

