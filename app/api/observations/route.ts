import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requireApiSession, apiErrorResponse } from '@/lib/session';
import { exec } from '@/lib/db';
import { assertMemberInTenant, assertSiteInTenant } from '@/lib/acl';

export async function POST(req: Request) {
  try {
    const s = await requireApiSession(req, 'team:inspections.execute');
    const body = await req.json();
    const action = body.action;

    if (action === 'publish_observations') {
      await assertMemberInTenant(s.tenantId, body.member_id);
      if (body.site_id) await assertSiteInTenant(s.tenantId, body.site_id);

      const items = Array.isArray(body.observations) ? body.observations : [];
      const createdIds: string[] = [];

      for (const item of items) {
        const id = 'obs-' + randomBytes(4).toString('hex');
        createdIds.push(id);
        await exec(
          `INSERT INTO observations
            (id, tenant_id, job_id, member_id, site_id, created_by, title, description, corrective_action,
             specific_location, assigned_company, priority, status, federal_citation, state_citation,
             photo_url, photo_kind, voice_transcript, ai_generated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, 1)`,
          [
            id,
            s.tenantId,
            body.job_id || null,
            body.member_id,
            body.site_id || null,
            s.user.id,
            String(item.title || 'Field Safety Observation').slice(0, 220),
            String(item.description || ''),
            String(item.corrective_action || ''),
            item.specific_location || null,
            item.assigned_company || null,
            ['Low', 'Med', 'High', 'Critical'].includes(item.priority) ? item.priority : 'High',
            item.federal_citation || '29 CFR 1926.1053(b)(1)',
            item.state_citation || 'Cal/OSHA 8 CCR §1675(i)',
            item.photo_url || '/brand/logo.png',
            ['hazard', 'positive', 'documentation'].includes(item.photo_kind) ? item.photo_kind : 'hazard',
            body.voice_transcript || null,
          ]
        );
      }

      if (body.job_id) {
        await exec(
          'UPDATE work_jobs SET status=IF(status IN ("received","scheduled"), "visit_done", status) WHERE id=? AND tenant_id=?',
          [body.job_id, s.tenantId]
        );
      }

      return NextResponse.json({ ok: true, createdIds });
    }

    if (action === 'update_status') {
      const nextStatus = ['open', 'in_progress', 'closed'].includes(body.status) ? body.status : 'open';
      await exec('UPDATE observations SET status=? WHERE id=? AND tenant_id=?', [nextStatus, body.id, s.tenantId]);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
