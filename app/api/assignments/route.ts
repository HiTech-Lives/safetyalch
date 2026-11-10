import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requireApiSession, apiErrorResponse } from '@/lib/session';
import { exec } from '@/lib/db';
import { assertUserInTenant } from '@/lib/acl';

export async function POST(req: Request) {
  try {
    const s = await requireApiSession(req, 'team:members.assign');
    const body = await req.json();
    const action = body.action;

    if (action === 'assign_job') {
      const userId = String(body.user_id);
      const jobId = String(body.job_id);
      await assertUserInTenant(s.tenantId, userId);

      await exec(
        'UPDATE work_jobs SET assigned_to=?, status=IF(status="received","scheduled",status) WHERE id=? AND tenant_id=?',
        [userId, jobId, s.tenantId]
      );
      await exec('UPDATE visits SET lead_user_id=? WHERE job_id=? AND tenant_id=?', [userId, jobId, s.tenantId]);
      return NextResponse.json({ ok: true });
    }

    if (action === 'add_certification') {
      const userId = String(body.user_id || '');
      await assertUserInTenant(s.tenantId, userId);
      const id = 'cert-' + randomBytes(4).toString('hex');
      await exec(
        'INSERT INTO user_certifications (id, tenant_id, user_id, code, issued_on, expires_on) VALUES (?, ?, ?, ?, ?, ?)',
        [
          id,
          s.tenantId,
          userId,
          String(body.code || '').slice(0, 40),
          body.issued_on || new Date().toISOString().slice(0, 10),
          body.expires_on || new Date(Date.now() + 730 * 86400000).toISOString().slice(0, 10),
        ]
      );
      return NextResponse.json({ ok: true, id });
    }

    if (action === 'add_time_away') {
      const userId = String(body.user_id || '');
      await assertUserInTenant(s.tenantId, userId);
      const id = 'pto-' + randomBytes(4).toString('hex');
      await exec(
        'INSERT INTO user_time_away (id, tenant_id, user_id, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?, ?)',
        [id, s.tenantId, userId, body.start_date, body.end_date, String(body.reason || 'Scheduled time away').slice(0, 190)]
      );
      return NextResponse.json({ ok: true, id });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
